namespace ebl {
   export interface Instruction extends vbl.Instruction { }
   export interface Block extends vbl.Block { }
   export interface Footer extends vbl.Footer { }
   export interface Header extends vbl.Header { }
   export interface Context extends vbl.Context {
      readonly host: Host;
   }
   export interface Host extends vbl.Host {
      readonly selected: Line;
   }
}

namespace ebl {
   export class Block extends vbl.Block { }
   class RBlockProvider extends Object implements BlockProvider, vbl.BlockProvider {
      makeBlock(owner: Header): Block { return new Block(owner as (Proc | Case)); }
   }
   export class RProc extends Proc {
      constructor(name: string, args: string[], state: State) {
         super(new RBlockProvider(), name, args, state);
      }
   }
   type TokKind = tks.TokKind;
   export abstract class Host extends vbl.Host {
      abstract get proc(): Proc;
      get useFont() { return rn.codeFont; }
      private readonly highlight0 = new Map<TokKind, {
         font?: Font,
         fill?: RGB
      }>([
         [tks.KW, { fill: RGB.dodgerblue }],
         [tks.ID, {}],
         [tks.NM, { fill: RGB.forestgreen }],
         [tks.LB, { fill: RGB.grey, font: rn.italicCodeFont }],
         [tks.SN, { fill: RGB.grey, font: rn.boldCodeFont }]
      ]);
      highlightFor(tok: [string, TokKind]): ({
         readonly font?: Font,
         readonly fill?: RGB,
      }) {
         let ret = this.highlight0.get(tok[1]);

         return ret;
      }
      // generates an undo for an instruction add. 
      completeAdd(ins: Instruction): rn.Undo {
         ins.doAdd();
         let undo = ins instanceof Goto ? this.doSelect(ins) : this.doSelectNextEdit(ins);
         return () => {
            undo();
            let del = ins.canDelete();
            if (!del)
               throw new Error();
            del[1]();
         }
      }
      private readonly random = new Random(42);
      // render a header for this host that adds a button
      // bar allowing for "delete", "goto", and "return"
      // TODO: add "break".
      renderHeader(txt: Context) {
         let sz = super.renderHeader(txt);
         let sz1 = txt.buttonBar((0).vec(sz.y), [
            ["delete", () => this.canDelete()],
            ["return", () => {
               if (!this.selected || !this.selected.canEdit())
                  return false;
               let state = this.selected.state;
               if (!state)
                  return false;
               if (this.proc.returnState) {
                  let unify = state.checkUnify(this.proc.returnState);
                  unify = unify ? unify : this.proc.returnState.checkUnify(state);
                  if (!unify)
                     return false;
               }
               let oldReturnState = this.proc.returnState;
               return () => {
                  let ret = new Return(this.selected);
                  let undo = this.completeAdd(ret);
                  return () => {
                     undo();
                     this.proc.returnState = oldReturnState;
                  }
               }
            }],
            ["exec", () => {
               let f0 = !this.selected ? false : this.proc.makeProfile(this.selected);
               if (!f0)
                  return false;
               let f = f0;
               return () => {
                  let oldProfile = this.proc.profile;
                  this.proc.profile = f(this.random);
                  return () => { 
                     this.proc.profile = oldProfile;
                  } // no undo.
               }
            }]
         ]);
         return sz.x.max(sz1.x).vec(sz.y + sz1.y + txt.g.fontHeight() / 2);
      }
      protected cleanupPress() {
         super.cleanupPress();
         if (this.selected instanceof Goto && this.selected.newAdd) {
            this.selected.newAdd = false;
            this.doSelectNextEdit(this.selected);
         }
      }
   }


   function renderBaseLine(rect: Rect2D, txt: Context): void {
      let line = this as Line;
      let toks = line.toks;
      let x = 0;
      for (let [s, tk] of toks) {
         let hl = txt.host.highlightFor([s, tk]);
         txt.g.fillText(s, rect.min.addX(x), hl);
         x += txt.g.textWidth(s, hl.font);
      }
      let proc = line.proc as Proc;
      if (proc.gotos.has(line)) {
         let [n, gotos] = proc.gotos.get(line);
         let s = " - L" + n;
         let hl = txt.host.highlightFor([s, tks.LB]);
         if (txt.host.selected instanceof Goto && gotos.has(txt.host.selected))
            hl = {
               fill: RGB.orangered,
               font: hl.font,
            }
         txt.g.fillText(s, rect.min.addX(x), hl);
         x += txt.g.textWidth(s, hl.font);
      }




      if (!(line instanceof Footer) && !(line as Instruction).isPassThroughState) {
         let doGoto = false;
         if (txt.host.selected == line && txt.host.canEdit()) {
            let state = line.state;
            let rS = !state ? [] : txt.host.proc.states.lookup(state).filter(([a, b]) => {
               if (b == line)
                  return false;
               else return true;
            });
            doGoto = rS.length > 0;
         }
         let doTarget = !doGoto && txt.host.selected instanceof Goto && txt.host.selected.target == line;

         let p0 = (rect.max.x - txt.SW * 3).vec(rect.min.y + 2);
         let p1 = (p0.x + txt.SW).vec(rect.max.y - 2);
         let rect0 = p0.rect(p1);
         txt.fillRect(rect0, doGoto ? RGB.dodgerblue.alpha(.5) : doTarget ? RGB.forestgreen.alpha(.5) : null, {
            label: "goto",
            addr: line,
            acts: [
               ["target", () => {
                  if (!doGoto)
                     return false;
                  return (m) => {
                     if (m instanceof bbl.BaseLine && !(m as Instruction).isPassThroughState) {
                        let other = m as (Instruction | Header);
                        if (line.state.checkUnify(other.state))
                           return () => {
                              let goto = new Goto(line, other);
                              if (other.isAfter(line))
                                 goto.isInvisible = true;
                              let undo = txt.host.completeAdd(goto);
                              let ret: [rn.Undo, rn.Address] = [undo, null];
                              return ret;
                           }
                     }
                     return false;
                  }
               }]
            ]
         });
      }
   }


   Footer.prototype.renderCoreLine = renderBaseLine;
   Proc.prototype.renderCoreLine = renderBaseLine;
   Case.prototype.renderCoreLine = renderBaseLine;
   Instruction.prototype.renderCoreLine = renderBaseLine;
}
namespace ebl {
   // defines VisHost, a variant of dm.Host
   // that implements all manipulation methods
   // by adding instructions.    
   export abstract class VisHost extends dm.Host {
      // where instructions are found and added to.
      abstract get code(): Host;
      // child is defined as the state of whatever
      // is selected in the code host. 
      get root() {
         let sel = this.code.selected;
         return sel ? sel.state : null;
      }
      // we can't even edit an image if the current
      // selected instruction cannot be edited (nowhere to add the new instruction).
      checkEdit() {
         let ins = this.code.selected;
         if (!ins)
            return false;
         if (!ins.canEdit())
            return false;
         return super.checkEdit();
      }
      /*
      private get block() { 
         let at = this.code.selected;
         if (at.tag == "header")
            return at.block;
         else return at.parent;
      }
      */
      tryFlipColor(addr: dm.NodeAddress): false | rn.Do {
         let result = addr.image.tryFlipColor(addr);
         if (!result)
            return false;
         let f = result;
         return () => {
            let [addr0, on] = f();
            if (this.code.selected instanceof FlipColor)
               return [this.code.selected.recycle(on, addr0.root), addr0];
            else {
               let undo = this.code.completeAdd(new FlipColor(this.code.selected, addr0.root, [on]));
               return [undo, addr0];
            }
         }
      }
      tryFlipAxis(addr: dm.NodeAddress): false | rn.Do {
         return () => {
            let result = addr.image.doFlipAxis(addr);
            let addr0 = result;
            if (this.code.selected instanceof FlipAxis)
               return [this.code.selected.recycle(addr.image.name, addr0.root), addr0];
            else {
               let undo = this.code.completeAdd(new FlipAxis(this.code.selected, addr0.root, [addr.image.name]));
               return [undo, addr0];
            }
         }
      }
      tryRotateUp(addr: dm.NodeAddress): false | rn.Do {
         let result = addr.image.tryRotateUp(addr);
         if (!result)
            return false;
         let f = result;
         return () => {
            let addr0 = f();
            let undo = this.code.completeAdd(new RotateUp(this.code.selected, addr0.root, addr.image.name, (addr.previous.image as dm.Node).name));
            return [undo, addr0];
         }
      }
      tryDelete(addr: dm.NodeAddress): false | rn.Do {
         let result = addr.image.tryDelete(addr);
         if (!result)
            return false;
         let f = result;
         return () => {
            let addr0 = f();
            let undo = this.code.completeAdd(new Delete(this.code.selected, addr0.root, addr.image.name));
            return [undo, addr0];
         }
      }
      tryCompress(addr: dm.NodeAddress | dm.RootParentAddress): false | rn.Do {
         let f0: false | (() => [dm.Address, dm.Node[]]);
         if (addr.image instanceof dm.Node) {
            f0 = addr.image.tryCompress(addr as dm.NodeAddress);
         } else {
            f0 = addr.image.tryCompress(addr as dm.RootParentAddress);
         }
         if (!f0)
            return false;
         let f = f0;
         return () => {
            let [addr0, Ns] = f();
            if (this.code.selected instanceof Compress) {
               let exist = this.code.selected;
               this.code.proc.unregister(exist);
               exist.Ns.push(...Ns.map(n => n.name));
               let oldState = exist.state;
               exist.state = addr0.root;
               this.code.proc.register(exist);
               let undo: rn.Undo = () => {
                  this.code.proc.unregister(exist);
                  exist.state = oldState;
                  for (let i = 0; i < Ns.length; i += 1)
                     exist.Ns.pop();
                  this.code.proc.register(exist);
               }
               return [undo, addr0];
            } else {
               let undo = this.code.completeAdd(new Compress(this.code.selected, addr0.root, Ns.map(n => n.name)));
               return [undo, addr0];
            }

            throw new Error();
         }


      }
      tryHeightVar(addr: dm.LeafAddress | dm.RootParentAddress): false | rn.Do {
         if (addr.image.height == "empty")
            return false;
         else if (addr.image.height.tag == "var")
            return false;
         return () => {
            let on: [string, "left" | "right" | "parent"];
            if (addr.image instanceof dm.Leaf) {
               let nA = addr.previous.image.name;
               (addr.at.name == "left" || addr.at.name == "right").assert();
               on = [nA, addr.at.name as "left" | "right"];
            } else {
               (addr.image instanceof dm.RootParent).assert();
               let nA = addr.image.child.name;
               on = [nA, "parent"];
            }
            if (this.code.selected instanceof AddHeightVar) {
               let exist = this.code.selected;
               let v = exist.k;
               let n = exist.value;
               let oldState = exist.state;
               this.code.proc.unregister(exist);
               exist.args.push(on);
               let ff = addr.image.addHeightVar(addr, v, n);
               if (!ff)
                  throw new Error();
               let addr0 = ff();
               exist.state = addr0.root;
               this.code.proc.register(exist);
               return [() => {
                  this.code.proc.unregister(exist);
                  exist.args.pop();
                  exist.state = oldState;
                  this.code.proc.register(exist);
               }, addr0];
            } else {
               let n = (addr.image.height as dm.HeightConcrete).concrete;
               let v = addr.root.freshHeightName("k");
               let ff = addr.image.addHeightVar(addr, v, n);
               if (!ff)
                  throw new Error();
               let addr0 = ff();
               let undo = this.code.completeAdd(new AddHeightVar(this.code.selected, addr0.root, v, n, [on]));
               return [undo, addr0];
            }
         }
      }
      tryCompareAxis(fromAddr: dm.NodeAddress): false | rn.Target {
         let from = fromAddr.image;
         if (from.left.equals(from.right))
            return false;
         if (from.axis == dm.Axis.Wild || from.axis.isVar()) { }
         else return false;
         return (intoAddr: dm.NodeAddress) => {
            let from = fromAddr.image;
            let into = intoAddr.image;
            let f0 = into.tryCompareAxis(intoAddr, fromAddr);
            if (!f0)
               return false;
            let f = f0;
            return () => {
               let at = this.code.selected;
               let axisV = fromAddr.image.axis.isVar() ? fromAddr.image.axis.varName : fromAddr.root.freshAxisName("𝛼");
               let ret = f(axisV);
               let newIns = new CompareAxis(this.code.selected, fromAddr.image.name, intoAddr.image.name, axisV, ret.unflipped.root, ret.flipped.root);
               let addr0 = ret.unflipped;
               return [this.code.completeAdd(newIns), addr0];
            }
         }
      }
      tryExpandLeaf(addr: dm.LeafAddress): false | rn.Do {
         let f0 = addr.image.tryExpand(addr);
         if (!f0)
            return false;
         let f = f0;
         return () => {
            let at = this.code.selected;
            // leave is either left of right child of node. 
            (addr.at.name == "left" || addr.at.name == "right").assert();
            let on = {
               on: addr.previous.image.name, by: addr.at.name as ("left" | "right"),
            }
            // expanded node will be an uncle. 
            let [U] = addr.root.freshNodeName([addr.previous.image.name == "G" ? "U" : "S"]);
            let result = f(U);
            let newIns: Switch;
            let addr0: dm.NodeAddress | dm.LeafAddress;
            // two kinds of results are possible depending on if leaf is black or leaf is unknown.
            if (result.tag == "black") {
               newIns = new ExpandLeafBlack(this.code.selected, on.on, on.by, U, result.node.root, result.empty ? result.empty.root : null);
               addr0 = result.node;
            } else {
               newIns = new ExpandLeafUnknown(this.code.selected, on.on, on.by, U, result.black.root, result.red.root);
               addr0 = result.black;
            }
            return [this.code.completeAdd(newIns), addr0];
         }
      }
      tryExpandRootFull(addr: dm.RootParentAddress): false | rn.Do {
         let f0 = addr.image.tryExpand(addr);
         if (!f0)
            return false;
         let f = f0;
         return () => {
            let at = this.code.selected;
            // introduce parent and grandparent nodes to cover the last two cases. 
            let [P, G] = addr.root.freshNodeName(["P", "G"]);
            let result = f(P, G);
            let newIns = new ExpandFullRoot(this.code.selected, addr.child.image.name, P, G, result.black.root, result.red.root, result.empty.root);
            let addr0 = result.black;
            return [this.code.completeAdd(newIns), addr0];
         }
      }
      tryExpandRootHalf(addr: dm.RootParentAddress): false | rn.Do {
         let f0 = addr.image.tryExpandHalf(addr);
         if (!f0)
            return false;
         let f = f0;
         return () => {
            let at = this.code.selected;
            // introduce parent and grandparent nodes to cover the last two cases. 
            let [P] = addr.root.freshNodeName(["P"]);
            let result = f(P);
            let newIns = new ExpandHalfRoot(this.code.selected, addr.child.image.name, P, result.notEmpty.root, result.empty.root);
            let addr0 = result.notEmpty;
            return [this.code.completeAdd(newIns), addr0];
         }
      }
      tryExpandRootHalf2(addr: dm.RootParentAddress): false | rn.Do {
         let f0 = addr.image.tryExpandHalf2(addr);
         if (!f0)
            return false;
         let f = f0;
         return () => {
            let at = this.code.selected;
            // introduce parent and grandparent nodes to cover the last two cases. 
            let [G] = addr.root.freshNodeName(["G"]);
            let result = f(G);
            if (at instanceof Case && at.index == 0 && at.owner instanceof ExpandHalfRoot) {
               let del = at.owner.canDelete();
               let empty = at.owner.cases[1].state;
               if (del && addr.child.left.image instanceof dm.Node) {
                  let undoA = del[1]();
                  let newIns = new ExpandFullRoot(at.owner.parent, addr.child.left.image.name, addr.child.image.name, G, result.black.root, result.red.root, empty)
                  let undoB = this.code.completeAdd(newIns);
                  let addr0 = result.black;
                  return [() => {
                     undoB();
                     undoA();
                  }, addr0];
               }
            }
            let newIns = new ExpandHalf2Root(this.code.selected, addr.child.image.name, G, result.black.root, result.red.root);
            let addr0 = result.black;
            return [this.code.completeAdd(newIns), addr0];
         }
      }
   }
}
namespace exe {


   export interface Node {
      render(pos: Vector2D, txt: rnexe.Context): [Vector2D, number];
   }
}
namespace rnexe {
   export interface Context extends rn.Context {
      readonly host: Host;

   }

   class VersionAddr extends Object implements rn.Address {
      constructor(readonly value : exe.Version) {
         super();
      }
      get adbg() { return this.value.toString(); }
      equals(other : rn.Address): boolean { return other instanceof VersionAddr && other.value == this.value; }
      isNestedIn(other : rn.Address): boolean { return this.equals(other); }
   }


   export abstract class Host extends rn.Host {
      get useFont() { return rn.codeFont; }
      abstract get proc(): ebl.Proc;
      get profile() { return this.proc.profile; }
      version: exe.Version = 0;
      updateVersion(to : exe.Version, line : ebl.Line) {
         this.version = to;
      }
      readonly reverse = new Map<exe.Node,[string,boolean]>();

      renderChild(pos: Vector2D, txt: Context): Vector2D {
         if (this.profile == undefined)
            return Vector2D.Zero;
         let profile = this.proc.update();
         let [etxt, instructions, code] = profile.result;
         {
            let y = pos.y + rn.smallCircleRad * 2;
            for (let i = 0; i < instructions.length; i += 1) {
               let pos0 = (pos.x + rn.smallCircleRad * 2).vec(y + rn.smallCircleRad);
               y += rn.smallCircleRad * 3;
               txt.fillSmallCircle(pos0, i == this.version ? RGB.orangered : RGB.grey, {
                  label: "version",
                  addr: new VersionAddr(i),
                  acts: [["scrub", () => (m : VersionAddr) => {
                     return () => 
                        this.updateVersion(m.value, instructions[m.value]);
                  }]]
               });
            }
         } 
         let y = pos.y;
         let x = pos.x + rn.smallCircleRad * 4;
         for (let [a, b] of profile.args) {
            let lbl: string;
            if (typeof b == "number")
               lbl = b.toString();
            else continue; // lbl = "Node(" + b[0].value.get(0) + (b[1] ? "-" : "+") + ")";
            txt.g.fillText(a + " = " + lbl, x.vec(y));
            y += txt.g.fontHeight();
         }
         this.reverse.clear();
         etxt.reverse(this.version, this.reverse);
         let root = etxt.root.get(this.version);
         let [size, anchorX] = root ? root.render(x.vec(y), txt) : [(0).vec(), 0];
         return size;
      }
   }
   exe.Node.prototype.render = function (pos, txt: Context) {
      let self = this as exe.Node;
      let left = self.left.get(txt.host.version);
      let right = self.right.get(txt.host.version);
      let color = self.color.get(txt.host.version);
      let value = self.value.get(txt.host.version);
      let name = value.toString();
      let r = Math.ceil(txt.standardRad(name));
      let h = pos.y + 2 * r + txt.SW * 2;

      let left0: [Vector2D, number];
      let right0: [Vector2D, number];
      if (left)
         left0 = left.render(pos.x.vec(h), txt);
      else {
         txt.fillSmallCircle((pos.x + r).vec(h), RGB.black);
         left0 = [(r).vec(0), pos.x + r];
      }
      let rx = Math.ceil(pos.x + left0[0].x + txt.SW / 2);
      if (right)
         right0 = right.render(rx.vec(h), txt);
      else {
         txt.fillSmallCircle((rx + r).vec(h), RGB.black);
         right0 = [(r).vec(0), rx + r];
      }
      let lax = left0[1];
      let rax = right0[1];
      let ax = lax.lerp(rax, .5);
      txt.fillSmallCircle(ax.vec(pos.y + r).add((r / 2).vec(-r / 2)),
         color == "red" ? RGB.red : color == "black" ? RGB.black : RGB.white);
      let lbld = txt.host.reverse.has(self);
      txt.strokeCircle(ax.vec(pos.y + r), r, name, null, lbld ? RGB.dodgerblue : null);
      if (lbld) {
         let [name,flipped] = txt.host.reverse.get(self);
         txt.fillText(ax.vec(pos.y + r * 2), name + (flipped ? "-" : ""), null, "center", RGB.dodgerblue);



      }

      // findC will figure out where to anchor tree lines on node.
      function findC(p: Vector2D) {
         // c - lx + lx = c
         let delta = (ax.vec(pos.y + r)).minus(p);
         return delta.normal().mult(delta.length() - r).add(p);
      }
      if (true) {
         let lk = lax.vec(h - txt.SW);
         let lp = findC(lk);
         let rk = rax.vec(lk.y);
         let rp = findC(rk);
         txt.g.strokeLine([lp, lk, lax.vec(h)]);
         txt.g.strokeLine([rp, rk, rax.vec(h)]);
      }
      return [(left0[0].x + txt.SW / 2 + right0[0].x).vec(h + left0[0].y.max(right0[0].y)), ax];
   }
}

namespace rbl {
   class CodeHost extends ebl.Host {
      constructor(readonly parent: Split) {
         super();
      }
      get proc() { return this.parent.proc; }
   }
   class VisHost extends ebl.VisHost {
      constructor(readonly parent: Split) {
         super();
      }
      get code() { return this.parent.left; }
      get offset() { return (100).vec(); }
   }
   class ExeHost extends rnexe.Host {
      constructor(readonly parent: Split) {
         super();
      }
      get proc() { return this.parent.proc; }
      updateVersion(to : exe.Version, ins : ebl.Line) {
         super.updateVersion(to, ins);
         this.parent.left.doSelect(ins);
      }
   }
   class Split extends rn.Split {
      readonly left: CodeHost;
      readonly right: VisHost;

      private readonly rightBottom0: ExeHost;
      get rightBottom() {
         return this.rightBottom0.profile != undefined ? this.rightBottom0 : null;
      }

      constructor(readonly parent: ui2.Top, readonly proc: ebl.RProc) {
         super();
         this.left = new CodeHost(this);
         this.right = new VisHost(this);
         this.rightBottom0 = new ExeHost(this);
      }
   }

   function makeTree(k: number, min: number, max: number, isBlack: boolean, r: Random, blackChance = 2): exe.Node {
      let clr: exe.Color = isBlack || (r.nextN(blackChance) % blackChance == 0) ? "black" : "red";
      if (clr == "black" && k == 1)
         return null;
      let value = Math.round((min + max) / 2);
      (value > min && value < max).assert();

      let k0 = clr == "black" ? k - 1 : k;
      (k0 >= 1).assert();
      let left = makeTree(k0, min, value, clr == "red", r, blackChance);
      let right = makeTree(k0, value, max, clr == "red", r, blackChance);
      return exe.Node.make({
         value: value,
         color: clr,
         left: left,
         right: right,
      })
   }



   export function mainInsert() {
      let empty = new dm.Leaf(dm.BaseHeight.concrete(1), "black", false);
      let N = new dm.Node("N", "red", dm.Axis.Wild, empty, empty);
      let R = new dm.RootParent(N, empty.height, false);
      let proc = new ebl.RProc("rbInsert", ["V"], dm.JustTree);
      let r = new Random(42);
      proc.makeArgs = (proc, root, r) => {
         let values = new Set<number>();
         if (root)
            root.values(0, values);
         while (true) {
            let n = r.nextN(1000);
            if (!values.has(n))
               return [["V", n]];
            else continue;
         }
      }
      // prime the code with binary insert. 
      let ins = new ebl.InsertBin(proc.block, R, "N", "V");
      ins.doAdd();
      let top = ui2.Top.useWindow();
      top.child = new Split(top, proc);
      top.renderAll();
   }
   export function mainRebalance() {
      let k0 = dm.BaseHeight.usingVar("k", 0);
      let k1 = dm.BaseHeight.usingVar("k", 1);
      let k2 = dm.BaseHeight.usingVar("k", 2);
      let N = new dm.Node("P", "unknown", dm.Axis.Wild, new dm.Leaf(k0, "black", false), new dm.Leaf(k1, "unknown", true));
      let R = new dm.RootParent(N, k2, true);

      let proc = new ebl.RProc("rbRebalance", [], R);
      proc.makeArgs = () => [];
      let top = ui2.Top.useWindow();
      top.child = new Split(top, proc);
      top.renderAll();
   }


}