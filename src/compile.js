// compile to WAST

const INT = 'i32', FLOAT = 'f64'

const isPrivate = func => func.name[0] === '_'

export default ir => {
  let func, out = [], globals = {}, exports = {}

  // serialize expression (depends on current ir, ctx)
  function expr (node) {
    // literal, like `foo`
    if (typeof node === 'string') {
      if (ir.global[node]) return `(global.get $${node})`
      if (func?.local[node] || func?.args[node]) return `(local.get $${node})`
      throw RangeError(`${node} is not defined`)
    }

    // another expression
    if (Array.isArray(node)) {
      let [op, ...args] = node
      return edict[op]?.(op, ...args) || ''
    }

    return node
  }

  // expressions mapping
  const edict = {
    '*': (op, a, b) => `(f64.mul ${expr(a)} ${expr(b)})`,
    'float': (op, a) => `(f64.const ${expr(a)})`
  }


  // 1. declare all functions
  for (let name in ir.func) {
    func = ir.func[name]
    out.push(`(func $${name} ${func.args.map(a=>`(param $${a} f64)`).join(' ')}\n${expr(func.body)}\n)`)
    if (!isPrivate(func)) exports[func.name] = 'func'
  }

  // 2. include imports

  // 3. declare all globals
  for (let name in ir.global) {
    let dfn = ir.global[name]
    let node = `global $${name} `

    // simple init
    if (dfn[0] === 'int') node += `${INT} (${INT}.const ${dfn[1]})`
    else if (dfn[0] === 'float') node += `${FLOAT} (${FLOAT}.const ${dfn[1]})`
    // requires start init
    // TODO: may need detecting expression result type
    else node += FLOAT, globals[name] = dfn

    out.push(`(${node})`)
  }

  // 3.1 init all globals in start
  if (Object.keys(globals).length) {
    out.push(`(start $module/init)`)
    let inits = []
    for (let name in globals) inits.push( `(global.set $${name} ${expr(globals[name])})` )

    out.push(`(func $module/init\n${inits.join('\n')}\n)`)
  }

  // 4. provide exports
  for (let name in exports) {
    out.push(`(export $${name} (${exports[name]} $${name}))`)
  }

  return out.join('\n')
}
