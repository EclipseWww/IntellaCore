// Restricted arithmetic/formula interpreter. Never executes workbook text as JavaScript.
function evaluateFormula(formula, sheetName, sheets, visiting = new Set()) {
  const tokens = formula.replace(/^=/, '').match(/"(?:[^"]|"")*"|'(?:[^']|'')*'!\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?|(?:[\p{L}_][\p{L}\p{N}_ .]*!)?\$?[A-Z]+\$?\d+(?::\$?[A-Z]+\$?\d+)?|\d+(?:\.\d+)?(?:E[+-]?\d+)?|[A-Z_][A-Z_0-9.]*|>=|<=|<>|[=<>+\-*/^(),;%&]/giu);
  if (!tokens || tokens.join('').replace(/\s+/g,'') !== formula.replace(/^=/,'').replace(/\s+/g,'')) throw new Error('不支持的公式');
  let pos = 0;
  const number = v => { if (Array.isArray(v)) throw new Error('期望单值'); if (v === null || v === '') return 0; if (!Number.isFinite(Number(v))) throw new Error('非数值'); return Number(v); };
  const cell = (name, address) => {
    const key = name + '!' + address.replace(/\$/g,'').toUpperCase();
    if (visiting.has(key)) throw new Error('循环引用');
    const props = sheets[name]?.cells[address.replace(/\$/g,'').toUpperCase()];
    if (!sheets[name]) throw new Error('工作表不存在');
    if (!props) return null;
    if (!props.formula) return props.value;
    visiting.add(key);
    try { return evaluateFormula(props.formula,name,sheets,visiting); } finally { visiting.delete(key); }
  };
  const reference = text => {
    const parts = text.split('!'), name = parts.length > 1 ? parts[0].replace(/^'|'$/g,'').replace(/''/g,"'") : sheetName;
    const range = parts[parts.length-1].replace(/\$/g,'').toUpperCase().split(':');
    if (range.length === 1) return cell(name,range[0]);
    const coord = a => { const m = a.match(/^([A-Z]+)(\d+)$/); return [m[1].split('').reduce((n,c)=>n*26+c.charCodeAt(0)-64,0),Number(m[2])]; };
    const [c1,r1] = coord(range[0]), [c2,r2] = coord(range[1]);
    if ((c2-c1+1)*(r2-r1+1)>100000 || c2<c1 || r2<r1) throw new Error('范围过大');
    const letter = n => { let out=''; while(n){n--;out=String.fromCharCode(65+n%26)+out;n=Math.floor(n/26);}return out; };
    const values=[]; for(let r=r1;r<=r2;r++) for(let c=c1;c<=c2;c++) values.push(cell(name,letter(c)+r)); return values;
  };
  const call = (name,args) => {
    const values=args.flat(), nums=values.filter(v=>typeof v==='number' && Number.isFinite(v));
    switch(name.toUpperCase()) {
      case 'SUM': return nums.reduce((a,b)=>a+b,0);
      case 'AVERAGE': if(!nums.length) throw new Error('无数值'); return nums.reduce((a,b)=>a+b,0)/nums.length;
      case 'MIN': return nums.length?Math.min(...nums):0;
      case 'MAX': return nums.length?Math.max(...nums):0;
      case 'COUNT': return nums.length;
      case 'COUNTA': return values.filter(v=>v!==null && v!=='').length;
      case 'ROUND': { const scale=10**number(args[1]); const n=number(args[0]);return Math.sign(n)*Math.round((Math.abs(n)+Number.EPSILON)*scale)/scale; }
      case 'COUNTIF': {
        const criterion=String(args[1]), m=criterion.match(/^(>=|<=|<>|>|<|=)?(.*)$/), expected=Number(m[2]);
        return [args[0]].flat().filter(v=> {
          if (!Number.isFinite(expected)) return m[1]==='<>' ? String(v)!==m[2] : String(v)===m[2];
          if(typeof v!=='number') return false;
          return {'>':v>expected,'<':v<expected,'>=':v>=expected,'<=':v<=expected,'<>':v!==expected,'=':v===expected}[m[1] || '='];
        }).length;
      }
      case 'ABS': return Math.abs(number(args[0]));
      case 'INT': return Math.floor(number(args[0]));
      case 'AND': return values.every(Boolean);
      case 'OR': return values.some(Boolean);
      case 'NOT': return !args[0];
      default: throw new Error('暂不支持函数：'+name);
    }
  };
  function primary() {
    const t=tokens[pos++]; if(!t) throw new Error('缺少操作数');
    if(t==='+' || t==='-') {const operand=primary();return ()=> (t==='-'?-1:1)*number(operand());}
    if(t==='('){const value=expression();if(tokens[pos++]!==')')throw new Error('缺少右括号');return value;}
    if(t.startsWith('"')) return ()=>t.slice(1,-1).replace(/""/g,'"');
    if(/^\d/.test(t)) return ()=>Number(t);
    if(/^(TRUE|FALSE)$/i.test(t) && tokens[pos]!=='(') return ()=>t.toUpperCase()==='TRUE';
    if(tokens[pos]==='('){
      pos++;const args=[];if(tokens[pos]!==')'){ do {args.push(expression());} while([',',';'].includes(tokens[pos]) && ++pos); }
      if(tokens[pos++]!==')')throw new Error('缺少右括号');
      const name=t.toUpperCase().replace(/^_XLFN\./,'');
      if(name==='IF') return ()=>Boolean(args[0]()) ? args[1]() : args[2] ? args[2]() : false;
      if(name==='IFERROR') return ()=>{try{return args[0]();}catch(error){return args[1]();}};
      if(name==='TRUE' || name==='FALSE') return ()=>name==='TRUE';
      return ()=>call(name,args.map(arg=>arg()));
    }
    return ()=>reference(t);
  }
  function power(){let v=primary();if(tokens[pos]==='%'){pos++;const operand=v;v=()=>number(operand())/100;}if(tokens[pos]==='^'){pos++;const left=v,right=power();v=()=>number(left())**number(right());}return v;}
  function product(){let v=power();while(['*','/'].includes(tokens[pos])){const op=tokens[pos++],left=v,right=power();v=()=>{const r=number(right());if(op==='/' && r===0)throw new Error('除数为零');return op==='*'?number(left())*r:number(left())/r;};}return v;}
  function sum(){let v=product();while(['+','-'].includes(tokens[pos])){const op=tokens[pos++],left=v,right=product();v=()=>op==='+'?number(left())+number(right()):number(left())-number(right());}return v;}
  function concat(){let v=sum();while(tokens[pos]==='&'){pos++;const left=v,right=sum();v=()=>String(left() ?? '')+String(right() ?? '');}return v;}
  function expression(){let v=concat();while(['=','<>','>=','<=','>','<'].includes(tokens[pos])){const op=tokens[pos++],left=v,right=concat();v=()=>{let a=left(),b=right();if(typeof a==='string' && typeof b==='string'){a=a.toUpperCase();b=b.toUpperCase();}return {'=':a===b,'<>':a!==b,'>=':a>=b,'<=':a<=b,'>':a>b,'<':a<b}[op];};}return v;}

  const result=expression()();if(pos!==tokens.length || (typeof result==='number' && !Number.isFinite(result)))throw new Error('公式无法计算');return result;
}
module.exports = { evaluateFormula };
