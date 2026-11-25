"""
IntellaCore turtle 模拟模块：把绘图指令通过 _ic_bridge.turtle_cmd 发给宿主页面绘制；
判题时 turtle_cmd 为 None，指令被忽略，但坐标、朝向等查询仍然正确。

与 harness.py 一样在前后端各有一份，内容必须一致：
  backend/src/services/pythonJudge/turtle.py
  frontend/public/libs/python-runner/turtle.py
"""
import json
import math

import _ic_bridge


def _send(cmd, args):
    callback = _ic_bridge.turtle_cmd
    if callback is not None:
        callback(cmd, json.dumps(args))


class Turtle:
    def __init__(self):
        self._x = 0.0
        self._y = 0.0
        self._heading = 0.0
        self._pensize = 1
        self._visible = True
        self._pendown = True
        self._color = "black"
        self._fillcolor = "black"
        self._filling = False
        self._speed = 6
        _send("init", {})

    def _move_to(self, x, y):
        self._x = float(x)
        self._y = float(y)

    def forward(self, d):
        d = float(d)
        rad = math.radians(self._heading)
        self._move_to(self._x + d * math.cos(rad), self._y + d * math.sin(rad))
        _send("forward", {"d": d})

    fd = forward

    def backward(self, d):
        self.forward(-float(d))

    bk = back = backward

    def right(self, a):
        a = float(a)
        self._heading = (self._heading - a) % 360
        _send("right", {"a": a})

    rt = right

    def left(self, a):
        a = float(a)
        self._heading = (self._heading + a) % 360
        _send("right", {"a": -a})

    lt = left

    def penup(self):
        self._pendown = False
        _send("penup", {})

    pu = up = penup

    def pendown(self):
        self._pendown = True
        _send("pendown", {})

    pd = down = pendown

    def isdown(self):
        return self._pendown

    def color(self, *args):
        if not args:
            return (self._color, self._fillcolor)
        if len(args) == 1:
            self._color = self._fillcolor = args[0]
            _send("color", {"c": args[0]})
        else:
            self._color, self._fillcolor = args[0], args[1]
            _send("color", {"c": args[0]})
            _send("fillcolor", {"c": args[1]})

    def pencolor(self, c=None):
        if c is None:
            return self._color
        self._color = c
        _send("color", {"c": c})

    def fillcolor(self, c=None):
        if c is None:
            return self._fillcolor
        self._fillcolor = c
        _send("fillcolor", {"c": c})

    def speed(self, s=None):
        if s is None:
            return self._speed
        names = {"fastest": 0, "fast": 10, "normal": 6, "slow": 3, "slowest": 1}
        s = names.get(s, s)
        self._speed = int(s)
        _send("speed", {"s": self._speed})

    def goto(self, x, y=None):
        if y is None:
            x, y = x[0], x[1]
        self._move_to(x, y)
        _send("goto", {"x": float(x), "y": float(y)})

    setpos = setposition = goto

    def setx(self, x):
        self._x = float(x)
        _send("setx", {"x": float(x)})

    def sety(self, y):
        self._y = float(y)
        _send("sety", {"y": float(y)})

    def circle(self, radius, extent=None, steps=None):
        radius = float(radius)
        ext = 360.0 if extent is None else float(extent)
        # 与真实 turtle 一致：圆心在乌龟左侧 radius 处，沿圆弧左转 ext 度
        rad = math.radians(self._heading)
        cx = self._x - radius * math.sin(rad)
        cy = self._y + radius * math.cos(rad)
        new_heading = self._heading + ext
        nrad = math.radians(new_heading)
        self._move_to(cx + radius * math.sin(nrad), cy - radius * math.cos(nrad))
        self._heading = new_heading % 360
        _send("circle", {"r": radius, "extent": extent, "steps": steps})

    def dot(self, size=None, *color):
        if size is None:
            size = max(self._pensize + 4, 2 * self._pensize)
        c = self._color
        if color:
            c = color[0] if len(color) == 1 else color
        _send("dot", {"size": float(size), "color": str(c)})

    def write(self, arg, move=False, align="left", font=("Arial", 8, "normal")):
        _send("write", {"text": str(arg), "align": align, "font": f"{font[1]}px {font[0]}"})

    def clear(self):
        _send("clear", {})

    def reset(self):
        self._move_to(0, 0)
        self._heading = 0.0
        _send("reset", {})

    def home(self):
        self._move_to(0, 0)
        self._heading = 0.0
        _send("home", {})

    def pensize(self, width=None):
        if width is None:
            return self._pensize
        self._pensize = width
        _send("pensize", {"w": float(width)})

    width = pensize

    def hideturtle(self):
        self._visible = False
        _send("hideturtle", {})

    ht = hideturtle

    def showturtle(self):
        self._visible = True
        _send("showturtle", {})

    st = showturtle

    def isvisible(self):
        return self._visible

    def setheading(self, angle):
        self._heading = float(angle) % 360
        _send("setheading", {"a": float(angle)})

    seth = setheading

    def heading(self):
        return self._heading

    def position(self):
        return (round(self._x, 2) + 0.0, round(self._y, 2) + 0.0)

    pos = position

    def xcor(self):
        return round(self._x, 2) + 0.0

    def ycor(self):
        return round(self._y, 2) + 0.0

    def towards(self, x, y=None):
        if y is None:
            x, y = x[0], x[1]
        return math.degrees(math.atan2(y - self._y, x - self._x)) % 360

    def distance(self, x, y=None):
        if y is None:
            x, y = x[0], x[1]
        return math.hypot(x - self._x, y - self._y)

    def begin_fill(self):
        self._filling = True
        _send("begin_fill", {})

    def end_fill(self):
        self._filling = False
        _send("end_fill", {})

    def filling(self):
        return self._filling

    def stamp(self):
        _send("stamp", {})
        return 0

    def shape(self, name=None):
        if name is None:
            return "classic"
        _send("shape", {"name": name})

    def shapesize(self, *args, **kwargs):
        pass

    turtlesize = shapesize


Pen = RawTurtle = Turtle


class _Screen:
    def bgcolor(self, *args):
        pass

    def title(self, *args):
        pass

    def setup(self, *args, **kwargs):
        pass

    def tracer(self, *args, **kwargs):
        pass

    def update(self):
        pass

    def mainloop(self):
        pass

    def exitonclick(self):
        pass

    def bye(self):
        pass

    def listen(self):
        pass

    def onkey(self, *args):
        pass

    def onclick(self, *args):
        pass

    def window_width(self):
        return 418

    def window_height(self):
        return 400


_screen = _Screen()


def Screen():
    return _screen


_t = Turtle()

for _name in [n for n in dir(Turtle) if not n.startswith("_")]:
    globals()[_name] = getattr(_t, _name)


def done():
    pass


mainloop = exitonclick = bye = done


def bgcolor(*args):
    pass


def title(*args):
    pass


def setup(*args, **kwargs):
    pass


def tracer(*args, **kwargs):
    pass


def update():
    pass
