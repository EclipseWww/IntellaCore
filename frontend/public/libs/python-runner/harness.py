"""
IntellaCore Python 运行与评测核心。

浏览器 Web Worker（交互运行、自测）与服务器判题进程共用同一份逻辑，以下两处文件内容必须完全一致
（backend/src/services/pythonJudge/harness.test.js 会校验）：
  backend/src/services/pythonJudge/harness.py
  frontend/public/libs/python-runner/harness.py

用户代码按原样编译执行（不包进函数、不做文本替换），因此 global、三引号字符串、行号都与本地 Python 一致。
交互运行时，若代码调用了 input()，用 AST 把相关调用改写为 await，并以“顶层 await”方式编译，
这样浏览器里无需阻塞主线程即可等待学生输入。
"""
import ast
import builtins
import inspect
import io
import sys
import types

MAIN_FILE = '<main>'

# turtle 等模块通过 _ic_bridge 与宿主通信；判题时保持为 None（绘图指令被忽略）
bridge = types.ModuleType('_ic_bridge')
bridge.turtle_cmd = None
sys.modules['_ic_bridge'] = bridge

_saved_builtins = dict(builtins.__dict__)
_saved_modules = None
_default_recursion_limit = sys.getrecursionlimit()
_real_streams = (sys.stdin, sys.stdout, sys.stderr)

ASYNC_INPUT_NAME = '_ic_input_async'
SYNC_INPUT_MESSAGE = (
    '这里暂不支持 input()：在 lambda、生成器（含 yield 的函数）、类体或 __init__ 等特殊方法中调用 input() 时无法等待输入。'
    '请把 input() 放到普通代码或普通函数里，例如先 name = input() 再把 name 传进去'
)


class OutputLimitExceeded(BaseException):
    """输出超过上限；继承 BaseException，避免被用户代码的 except Exception 吞掉。"""


def snapshot():
    """记录当前已加载的模块，之后每次运行前清理掉新导入的模块。"""
    global _saved_modules
    _saved_modules = set(sys.modules)


def reset():
    builtins.__dict__.clear()
    builtins.__dict__.update(_saved_builtins)
    if _saved_modules is not None:
        for name in list(sys.modules):
            if name not in _saved_modules:
                del sys.modules[name]
    sys.setrecursionlimit(_default_recursion_limit)
    sys.stdin, sys.stdout, sys.stderr = _real_streams


class _Output(io.TextIOBase):
    encoding = 'utf-8'

    def __init__(self, sink, limit=None):
        self._sink = sink
        self._limit = limit
        self.size = 0
        self.truncated = False

    def writable(self):
        return True

    def isatty(self):
        return False

    def write(self, s):
        s = str(s)
        if not s:
            return 0
        if self._limit is not None:
            room = self._limit - self.size
            if len(s) > room:
                self.truncated = True
                if room > 0:
                    self._sink(s[:room])
                    self.size += room
                raise OutputLimitExceeded()
        self.size += len(s)
        self._sink(s)
        return len(s)

    def flush(self):
        pass


def _fresh_globals():
    return {'__name__': '__main__', '__builtins__': builtins}


def _source_line(code, line):
    if not line:
        return None
    lines = code.splitlines()
    if 1 <= line <= len(lines):
        return lines[line - 1]
    return None


def describe_error(exc, code):
    info = {'type': type(exc).__name__, 'message': str(exc), 'line': None, 'text': None}
    if isinstance(exc, SyntaxError):
        info['message'] = exc.msg or str(exc)
        info['line'] = exc.lineno
        info['text'] = (exc.text or '').rstrip('\r\n') or _source_line(code, exc.lineno)
        return info
    tb = exc.__traceback__
    line = None
    while tb is not None:
        if tb.tb_frame.f_code.co_filename == MAIN_FILE:
            line = tb.tb_lineno
        tb = tb.tb_next
    info['line'] = line
    info['text'] = _source_line(code, line)
    return info


# ---------------------------------------------------------------- 判题模式

def _stdin_input(stdin):
    def _input(prompt=''):
        # 判题时不输出提示词，学生在 input("请输入") 里写提示不影响结果
        line = stdin.readline()
        if not line:
            # 输入用完返回空字符串，兼容末尾 input("按回车退出") 的写法
            return ''
        if line.endswith('\n'):
            line = line[:-1]
        if line.endswith('\r'):
            line = line[:-1]
        return line
    return _input


def run_judge(code, stdin_text='', output_limit=65536):
    """用给定输入运行一次代码，返回 stdout 与错误信息（stderr 不计入输出）。"""
    reset()
    parts = []
    out = _Output(parts.append, output_limit)
    err = _Output(lambda s: None, output_limit)
    stdin = io.StringIO(stdin_text or '')
    builtins.input = _stdin_input(stdin)
    error = None
    sys.stdin, sys.stdout, sys.stderr = stdin, out, err
    try:
        exec(compile(code, MAIN_FILE, 'exec', dont_inherit=True), _fresh_globals())
    except SystemExit:
        pass
    except OutputLimitExceeded:
        pass
    except BaseException as exc:  # noqa: BLE001 - 需要报告所有用户代码异常
        error = describe_error(exc, code)
    finally:
        sys.stdin, sys.stdout, sys.stderr = _real_streams
    return {'stdout': ''.join(parts), 'truncated': out.truncated, 'error': error}


# ---------------------------------------------------------------- 交互模式（仅浏览器）

_SCOPES = (ast.FunctionDef, ast.AsyncFunctionDef, ast.Lambda, ast.ClassDef)


def _own_nodes(func):
    """函数体自身的节点，不进入嵌套的函数 / lambda / 类。"""
    stack = [n for n in func.body if not isinstance(n, _SCOPES)]
    while stack:
        node = stack.pop()
        yield node
        for child in ast.iter_child_nodes(node):
            if not isinstance(child, _SCOPES):
                stack.append(child)


def _is_dunder(name):
    return name.startswith('__') and name.endswith('__')


def _find_async_functions(tree):
    """找出需要改成 async 的函数：直接或间接调用了 input()。返回 (函数节点 id 集合, 函数名集合, 方法名集合)。"""
    parents = {}
    for node in ast.walk(tree):
        for child in ast.iter_child_nodes(node):
            parents[id(child)] = node
    funcs = []
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            names, attrs, has_yield = set(), set(), False
            for sub in _own_nodes(node):
                if isinstance(sub, (ast.Yield, ast.YieldFrom)):
                    has_yield = True
                elif isinstance(sub, ast.Call):
                    if isinstance(sub.func, ast.Name):
                        names.add(sub.func.id)
                    elif isinstance(sub.func, ast.Attribute):
                        attrs.add(sub.func.attr)
            is_method = isinstance(parents.get(id(node)), ast.ClassDef)
            convertible = not has_yield and not (is_method and _is_dunder(node.name))
            funcs.append((node, names, attrs, is_method, convertible))
    async_ids, async_names, async_attrs = set(), set(), set()
    changed = True
    while changed:
        changed = False
        for node, names, attrs, is_method, convertible in funcs:
            if id(node) in async_ids or not convertible:
                continue
            if 'input' in names or names & async_names or attrs & async_attrs:
                async_ids.add(id(node))
                (async_attrs if is_method else async_names).add(node.name)
                changed = True
    return async_ids, async_names, async_attrs


class _AsyncInputTransformer(ast.NodeTransformer):
    def __init__(self, async_ids, async_names, async_attrs):
        self.async_ids = async_ids
        self.async_names = async_names
        self.async_attrs = async_attrs
        self.can_await = [True]  # 模块顶层允许 await（PyCF_ALLOW_TOP_LEVEL_AWAIT）

    def _scoped(self, node, can_await):
        self.can_await.append(can_await)
        try:
            return self.generic_visit(node)
        finally:
            self.can_await.pop()

    def visit_FunctionDef(self, node):
        is_async = id(node) in self.async_ids
        node = self._scoped(node, is_async)
        if not is_async:
            return node
        new = ast.AsyncFunctionDef(**{field: getattr(node, field, None) for field in ast.AsyncFunctionDef._fields})
        return ast.copy_location(new, node)

    def visit_AsyncFunctionDef(self, node):
        return self._scoped(node, True)

    def visit_Lambda(self, node):
        return self._scoped(node, False)

    def visit_ClassDef(self, node):
        return self._scoped(node, False)

    def _awaitable(self, call):
        func = call.func
        if isinstance(func, ast.Name):
            return func.id == 'input' or func.id in self.async_names
        if isinstance(func, ast.Attribute):
            return func.attr in self.async_attrs
        return False

    def visit_GeneratorExp(self, node):
        node = self.generic_visit(node)
        # 生成器表达式里的 await 会变成异步生成器，sum()/max() 等无法使用；改成等价的列表推导
        if self.can_await[-1] and any(isinstance(n, ast.Await) for n in ast.walk(node)):
            return ast.copy_location(ast.ListComp(elt=node.elt, generators=node.generators), node)
        return node

    def visit_Call(self, node):
        node = self.generic_visit(node)
        if not self.can_await[-1] or not self._awaitable(node):
            return node
        if isinstance(node.func, ast.Name) and node.func.id == 'input':
            node.func = ast.copy_location(ast.Name(id=ASYNC_INPUT_NAME, ctx=ast.Load()), node.func)
        return ast.copy_location(ast.Await(value=node), node)


def _calls_input(tree):
    return any(isinstance(n, ast.Call) and isinstance(n.func, ast.Name) and n.func.id == 'input' for n in ast.walk(tree))


def compile_interactive(code):
    tree = ast.parse(code, MAIN_FILE, 'exec')
    flags = 0
    if _calls_input(tree):
        tree = _AsyncInputTransformer(*_find_async_functions(tree)).visit(tree)
        ast.fix_missing_locations(tree)
        flags = ast.PyCF_ALLOW_TOP_LEVEL_AWAIT
    return compile(tree, MAIN_FILE, 'exec', flags=flags, dont_inherit=True)


async def run_interactive(code, write, request_input, output_limit=None):
    """交互运行：输出实时写给 write(text)，input() 通过 await request_input(prompt) 获取。"""
    reset()
    out = _Output(write, output_limit)

    async def _input_async(prompt=''):
        prompt = str(prompt)
        if prompt:
            out.write(prompt)
        value = await request_input(prompt)
        return '' if value is None else str(value)

    def _input_sync(prompt=''):
        raise RuntimeError(SYNC_INPUT_MESSAGE)

    builtins.input = _input_sync
    setattr(builtins, ASYNC_INPUT_NAME, _input_async)
    sys.stdin, sys.stdout, sys.stderr = io.StringIO(''), out, out
    error = None
    try:
        result = eval(compile_interactive(code), _fresh_globals())
        if inspect.iscoroutine(result):
            await result
    except SystemExit:
        pass
    except OutputLimitExceeded:
        pass
    except BaseException as exc:  # noqa: BLE001
        error = describe_error(exc, code)
    finally:
        sys.stdin, sys.stdout, sys.stderr = _real_streams
    return {'error': error, 'truncated': out.truncated}
