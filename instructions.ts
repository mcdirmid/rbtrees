// final file, ties blocks.ts with vis.ts together (and indireclty domain.ts). 
// basically fills out line and blocks with RB tree syntax highlighted code.
// Adds this code by filling out Host from vis.ts so they are driven by manipulations
// of RB tree images. 
namespace ins {
   // line state is just a root image from domain. 
   export type State = dm.Root;
   // upgrade baseblock, case, and proc with refined type definitions.  
   interface BaseBlock extends bl.BaseBlock {
      readonly info: BlockInfo;
      readonly proc: Proc;
      readonly parentBlock: Block | null;
   };
   export interface Case extends bl.Case, BaseBlock {
      readonly parent: Switch
      readonly info: BlockInfo;
      readonly proc: Proc;
      readonly parentBlock: Block;
   };
   export interface Proc extends bl.Proc, BaseBlock {
      readonly info: ProcInfo;
      readonly states: bl.HashUnify<dm.Unify, Instruction | Header>;
      readonly proc: Proc;
      readonly parentBlock: null;
   }
   export type Block = Case | Proc;
   // token kinds used for syntax highlighting. 
   export type TokKind = string;
   export const ID: TokKind = "ID";
   export const KW: TokKind = "KW";
   export const SN: TokKind = "SN";
   export const NM: TokKind = "NM";
   export const LB: TokKind = "LB";
   // block host implements syntax highlighting. 
   export abstract class Host extends bl.Host {
      abstract get root(): Proc;
      get useFont() { return rn.codeFont; }

      private readonly highlight0 = new Map<TokKind, {
         font?: Font,
         fill?: RGB
      }>([
         [KW, { fill: RGB.dodgerblue }],
         [ID, {}],
         [NM, { fill: RGB.forestgreen }],
         [LB, { fill: RGB.grey, font: rn.italicCodeFont }],
         [SN, { fill: RGB.grey, font: rn.boldCodeFont }]
      ]);
      highlightFor(tok: TokKind): ({
         readonly font?: Font,
         readonly fill?: RGB,
      }) {
         return this.highlight0.get(tok);
      }
      get selected() { return super.selected as Line; }
      set selected(value: Line) { super.selected = value; }
      // generates an undo for an instruction add. 
      completeAdd(ins: Instruction): rn.Undo {
         ins.parent.addInstruction(ins);
         let undo = super.selectNextEdit(ins);
         return () => {
            undo();
            let del = ins.parent.canDelete(ins);
            if (!del)
               throw new Error();
            del();
         }
      }
      // render a header for this host that adds a button
      // bar allowing for "delete", "goto", and "return"
      // TODO: add "break".
      renderHeader(txt: Context) {
         let sz = super.renderHeader(txt);
         let sz1 = txt.buttonBar((0).vec(sz.y), [
            ["delete", () => this.canDelete()],
            ["goto", () => {
               if (!this.selected || !this.selected.parent.canEdit(this.selected))
                  return false;
               let state = this.selected.state;
               if (!state)
                  return false;
               let ret = this.root.states.lookup(state).find(([a, b]) => b != this.selected);
               if (!ret)
                  return false;
               return () => {
                  let [unify, target] = ret;
                  let goto = new Goto(this.selected.parent, target);
                  return this.completeAdd(goto);
               }
            }],
            ["return", () => {
               if (!this.selected || !this.selected.parent.canEdit(this.selected))
                  return false;
               let state = this.selected.state;
               if (!state)
                  return false;
               if (this.root.info.returnState) {
                  let unify = state.checkUnify(this.root.info.returnState);
                  unify = unify ? unify : this.root.info.returnState.checkUnify(state);
                  if (!unify)
                     return false;
               }
               return () => {
                  let ret = new Return(this.selected.parent);
                  return this.completeAdd(ret);
               }
            }]
         ]);
         return sz.x.max(sz1.x).vec(sz.y + sz1.y);
      }
   }
   // a list of tokens as (string, token kind) pairs.
   export type Toks = [string, TokKind][];
   // upgrade Context with Host's new type.
   export interface Context extends bl.Context {
      readonly host: Host;
   }
   // render a list of tokens using host specified formatting. 
   export function renderToks(pos: Vector2D, toks: [string, TokKind][], txt: Context) {
      let x = 0;
      for (let [s, tk] of toks) {
         let hl = txt.host.highlightFor(tk);
         txt.g.fillText(s, pos.addX(x), hl);
         x += txt.g.textWidth(s, hl.font);
      }

   }
   // all blocks have headers with keywords (proc, case, etc...).
   // they also have a state for the header (e.g. proc's input state, a state for each case).
   abstract class BlockInfo extends Object implements bl.BlockInfo {
      abstract get headerKw(): string;
      constructor(readonly headerToks: Toks, readonly headerState: State) {
         super();
      }
      renderHeader(header: Header, pos: Vector2D, txt: Context): void {
         let toks = ([[this.headerKw + " ", KW]] as Toks).concat(this.headerToks);
         let lbl = header.parent.proc.labelFor(header);
         if (lbl) // if target of goto, render assigned label here so we know where goto is going. 
            toks = toks.concat([[" - ", SN], [lbl, LB]])
         renderToks(pos, toks, txt);
      }
      readonly instructions = new Array<Instruction>();
   }
   export class CaseInfo extends BlockInfo { get headerKw() { return "case"; } }
   export class ProcInfo extends BlockInfo implements bl.ProcInfo {
      get headerKw() { return "proc"; }
      constructor(headerToks: Toks, readonly footerToks: Toks, headerState: State) {
         super(headerToks, headerState);
      }
      renderFooter(footer: Footer, pos: Vector2D, txt: Context): void {
         renderToks(pos, [["end" + this.headerKw, KW]], txt);
      }
      lineHeight(txt: Context) { return txt.g.fontHeight(); }
      returnState0?: State;
      get returnState() { return this.returnState0; }
      // track returns of procedure. 
      readonly returns = new Set<Return>();
   }
   // upgraded types. 
   export interface BaseLine extends bl.BaseLine {
      readonly state?: State;
      readonly parent: Block;
   }
   export interface Header extends bl.Header, bl.BaseLine, BaseLine {
      readonly state?: State;
      readonly parent: Block;
   }
   export interface Footer extends bl.Footer, bl.BaseLine, BaseLine {
      readonly state?: State;
      readonly parent: Block;
   }
   export type Line = Instruction | Header | Footer;
   // finally, an implementation of instruction; nothing amazing here, just record indices,
   // have a state that will be specified somewhere else, and basic rendering 
   export abstract class Instruction extends Object implements bl.Instruction, BaseLine {
      readonly index: number;
      abstract get state(): State;
      constructor(readonly parent: Block) {
         super();
         this.index = parent.info.instructions.length;
      }
      protected abstract get toks(): Toks;
      renderLine(pos: Vector2D, txt: Context): void {
         let toks = this.toks;
         let lbl = this.parent.proc.labelFor(this);
         if (lbl) // add label if instruction is target of goto.
            toks = toks.concat([[" - ", SN], [lbl, LB]])
         renderToks(pos, toks, txt);
      }
   }

   //export interface Unify extends dm.Unify, bl.Unify { }
}


// Axis, Height, and Unify should provide toks for rendering. 
// So let's monkey patch that in. 
namespace dm {
   export interface Axis {
      renderToks(): ins.Toks;
   }
   export interface BaseHeight {
      renderToks(): ins.Toks;
   }
   export interface Unify {
      renderToks(): ins.Toks;
   }
}

// utilitiy package with rendering functions, 
// not meant to leak through outside of this file. 
namespace insrn {
   type Toks = ins.Toks;

   dm.Axis.prototype.renderToks = function () {
      let self = this as dm.Axis;
      if (self.isVar())
         return [[self.varName, ins.ID]];
      else return [[self.adbg, ins.KW]];
   }
   dm.BaseHeight.prototype.renderToks = function () {
      let self = this as dm.Height;
      if (self.tag == "var") {
         let ret: ins.Toks = [[self.varName, ins.ID]];
         if (self.varAdjust != 0) {
            ret = ret.concat([[self.varAdjust < 0 ? " - " : " + ", ins.KW]])
            ret = ret.concat([[Math.abs(self.varAdjust).toString(), ins.NM]])
         }
         return ret;
      } else {
         return [[self.concrete.toString(), ins.NM]];
      }
   }
   dm.Unify.prototype.renderToks = function () {
      let self = this as dm.Unify;
      let ret: Toks[] = [];
      for (let [a, b] of self.aS) {
         if (b.varName == a)
            continue;
         ret.push(assign(
            dm.Axis.varAxis(a).renderToks(),
            b.renderToks(),
         ))
      }
      for (let [a, b] of self.hS) {
         if (b.varName == a && b.varAdjust == 0)
            continue;
         ret.push(assign(
            dm.BaseHeight.usingVar(a, 0).renderToks(),
            b.renderToks(),
         ))
      }
      for (let [a, b] of self.nS) {
         if (a == b)
            continue;
         ret.push(assign([[a, ins.ID]], [[b, ins.ID]]))
      }
      if (ret.isEmpty())
         return [];
      else return mkList(ret, ["[", "]"]);
   }
   // keywords that might be used in identifier contexts, so just look for them. 
   export const keywords = new Set<string>(
      ["empty", "red", "black"]
   )
   // convenience type that can be translated into Toks.
   // allows us to use strings, numbers, etc... when specifying
   // renderings blow. 
   export type TokParam = Toks | string | number | boolean | { readonly on: Toks | string, readonly by: "parent" | "left" | "right" | "axis" | "color" };
   // translate TokParam into proper Toks. 
   export function toToks(param: TokParam): Toks {
      if (typeof param == "string")
         return [[param, keywords.has(param) ? ins.KW : ins.ID]];
      else if (param instanceof Array)
         return param
      else if (typeof param == "number")
         return [[param.toString(), ins.NM]];
      else if (typeof param == "boolean")
         return [[param ? "true" : "false", ins.NM]];
      else {
         let on = toToks(param.on);
         return on.concat([[".", ins.SN], [param.by, ins.ID]]);
      }
   }
   // generate Toks for assignment.
   export function assign(lhs: TokParam, rhs: TokParam) {
      return toToks(lhs).concat([[" = ", ins.SN]]).concat(toToks(rhs));
   }
   // generate Toks for equivalence.
   export function equiv(lhs: TokParam, ...rhsS: TokParam[]) {
      let ret = toToks(lhs);
      for (let rhs of rhsS)
         ret = ret.concat([[" == ", ins.SN]]).concat(toToks(rhs));
      return ret;
   }
   // generate Toks for a list of things separated by a comma. 
   export function mkList(toks: TokParam[], openClose?: [string, string]) {
      let ret: Toks = [[openClose ? openClose[0] : "(", ins.SN]];
      let isFirst = true;
      for (let t of toks) {
         if (isFirst)
            isFirst = false;
         else ret.push([", ", ins.SN]);
         ret.push(...toToks(t));
      }
      ret.push([openClose ? openClose[1] : ")", ins.SN])
      return ret;
   }
}

// Flesh out instruction types.
namespace ins {

   // any instruction that does not produce its own state and
   // "passes" it through from the previous instruction.
   export abstract class PassThrough extends Instruction {
      get state(): State {
         if (this.index == 0)
            return this.parent.info.headerState;
         let prev = this.parent.info.instructions[this.index - 1];
         if (prev instanceof Switch)
            return prev.breakState;
         else return prev.state;
      }
      get isPassThroughState(): true { return true; }
   }
   type TokParam = insrn.TokParam;
   // a switch implementation.
   export class Switch extends PassThrough implements bl.Switch {
      readonly breaks = new Set<Break>();
      readonly cases: Case[];
      breakState0?: State;
      get breakState(): State { return this.breakState0; }
      // since we are just using for display, we can just pass through
      // rendering tokens directly when creating the object. 
      constructor(parent: Block, readonly on: TokParam, cases: [TokParam, State][]) {
         super(parent);
         this.cases = parent.initCases(this,
            cases.map(([param, image]) => new CaseInfo(insrn.toToks(param), image))) as Case[];
      }
      renderFooter(pos: Vector2D, txt: Context): void {
         renderToks(pos, [["endswitch", KW]], txt);
      }
      // computes how this switch ends. 
      // if a case doesn't return, goto, or break, then
      // this returns false. If it has at least one break
      // clause, then the switch is broken. If all control 
      // flow leaves via goto and return, then the switch
      // is "notbroken".
      isClosed(): false | "broken" | "notbroken" {
         let broken: "broken" | "notbroken" = "notbroken";
         for (let b of this.cases) {
            if (b.info.instructions.length == 0)
               return false; // no instructions, control flow is unspecified (false)
            let last = b.info.instructions.last();
            if (last instanceof Break) {
               // a break, so control flow is broken if it doesn't fail otherwise. 
               broken = "broken";
               continue;
            } else if (last instanceof Goto || last instanceof Break || last instanceof Return)
               // "notbroken" control flow.
               continue;
            // ends in a switch, this is only proper if the switch itself is "notbroken".
            else if (last instanceof Switch && last.isClosed() == "notbroken")
               continue;
            else return false;
         }
         return broken;
      }
      // something can follow the switch only if its control flow is broken. 
      footerCanEdit(): boolean { return this.isClosed() == "broken"; }
      get toks() { return ([["switch ", KW]] as Toks).concat(insrn.toToks(this.on)); }
   }
   // a basic goto that goes from one similar state to another similar state. 
   // used to economize instructions (we've seen this already) and also to form
   // loops (where the end and head of a loop must be similar unifiable states).
   export class Goto extends PassThrough implements bl.Goto {
      get toks(): Toks {
         let ret = this.unify.renderToks();
         ret.unshift(["goto", KW], [
            " L" + this.parent.proc.gotos.get(this.target)[0].toString(), LB
         ]);
         return ret;
      }
      private get unify() {
         let unify = this.state.checkUnify(this.target.state);
         if (!unify)
            throw new Error();
         return unify;
      }
      constructor(parent: Block, readonly target: Header | Instruction) {
         super(parent);
         (!(target as bl.Instruction).isPassThroughState).assert();
      }
   }
   // a break statement that leaves a case block to completion,
   // all breaks must have compatible states. 
   export class Break extends PassThrough {
      get toks(): Toks {
         let zwitch = (this.parent as Case).parent;
         let unify = zwitch.state.checkUnify(zwitch.breakState0);
         if (!unify)
            throw new Error();
         let ret = unify.renderToks();
         ret.unshift(["break", KW]);
         return ret;
      }
      addInner() {
         let zwitch = (this.parent as Case).parent;
         zwitch.breaks.add(this);
         if (zwitch.breakState0 == null)
            zwitch.breakState0 = this.state;
         else {
            let unify = this.state.checkUnify(zwitch.breakState0);
            if (!unify) {
               unify = zwitch.breakState0.checkUnify(this.state);
               if (!unify)
                  throw new Error();
               zwitch.breakState0 = this.state;
            }
         }
      }
      deleteInner() {
         let zwitch = (this.parent as Case).parent;
         zwitch.breaks.delete(this).assert();
         if (zwitch.breaks.isEmpty())
            delete zwitch.breakState0;
      }
   }
   // a return statement that leaves a procedure,
   // analogous to the break statement.  
   export class Return extends PassThrough {
      get toks(): Toks {
         let top = this.parent.proc;
         let unify = this.state.checkUnify(top.info.returnState0);
         if (!unify)
            throw new Error();
         let ret = unify.renderToks();
         ret.unshift(["return", KW]);
         return ret;
      }
      addInner() {
         let top = this.parent.proc;
         top.info.returns.add(this);
         if (top.info.returnState0 == null)
            top.info.returnState0 = this.state;
         else {
            let unify = this.state.checkUnify(top.info.returnState0);
            if (!unify) {
               unify = top.info.returnState0.checkUnify(this.state);
               if (!unify)
                  throw new Error();
               top.info.returnState0 = this.state;
            }
         }
      }
      deleteInner() {
         let top = this.parent.proc;
         top.info.returns.delete(this).assert();
         if (top.info.returns.isEmpty())
            delete top.info.returnState0;
      }
   }
   // a "simple" instruction used for all non-branching ones. 
   export class Simple extends Instruction {
      get toks(): Toks {
         let ret: Toks = [];
         ret.push([this.callName, ID]);
         ret.push(...insrn.mkList(this.args.map(a => insrn.toToks(a))));
         if (this.assign)
            ret = insrn.assign(this.assign, ret);
         return ret;
      }
      constructor(
         parent: Block, readonly state: State, readonly callName: string,
         readonly args: TokParam[], readonly assign?: string, readonly extra?: any) {
         super(parent);
      }
   }
   // produces syntax of the form Node(red, P = Node(black))
   // used in case headers as pattern matches during expansions. 
   export function nodePattern(nm: string, clr: "red" | "black", parent?: Toks): Toks {
      let args: Toks[] = [];
      args.push(insrn.toToks(nm), [[clr, KW]]);
      if (parent)
         args.push(insrn.assign("parent", parent));
      let ret: Toks = [["Node", ID]];
      ret = ret.concat(insrn.mkList(args));
      return ret;
   }
}
// functions for producing simple and switch instructions based on domain manipulations.
namespace ins {
   type TokParam = insrn.TokParam;
   export function flipColor(parent: Block, state: State, args: TokParam[]) {
      return new Simple(parent, state, "flipColor", args);
   }
   export function flipAxis(parent: Block, state: State, args: TokParam[]) {
      return new Simple(parent, state, "flipAxis", args);
   }
   export function rotateUp(parent: Block, state: State, arg: string) {
      return new Simple(parent, state, "rotateUp", [arg]);
   }
   export function compress(parent: Block, state: State, args: TokParam[]) {
      return new Simple(parent, state, "compress", args);
   }
   export function heightVar(parent: Block, state: State, varName: string, value: number, on: TokParam[]) {
      return new Simple(parent, state, "heightVar", [value as TokParam].concat(on), varName, value);
   }
   export function compareAxis(parent: Block, nA: string, nB: string, varName: string, unflipped: State, flipped: State) {
      let on = insrn.equiv({ on: nA, by: "axis" }, { on: nB, by: "axis" }, varName);
      return new Switch(parent, on, [
         [true, unflipped],
         [false, flipped],
      ]);
   }
   export function expandUnknown(parent: Block, on: { on: string, by: "left" | "right" }, nA: string, onBlack: State, onRed: State) {
      let black = ([] as Toks).concat(insrn.toToks("Leaf")).concat(insrn.mkList(["black"]));
      let red = nodePattern(nA, "red");
      return new Switch(parent, insrn.toToks(on), [
         [black, onBlack], [red, onRed],
      ]);
   }
   export function expandBlack(parent: Block, on: { on: string, by: "left" | "right" }, nA: string, onNode: State, onEmpty?: State) {
      let node = nodePattern(nA, "black");
      let empty = onEmpty ? insrn.toToks("empty") : null;
      let cases: [Toks, State][] = [[node, onNode]];
      if (empty)
         cases.push([empty, onEmpty]);
      return new Switch(parent, insrn.toToks(on), cases);
   }
   export function expandRoot(parent: Block, topNode: string, P: string, G: string, args: {
      empty: State, black: State, red: State,
   }) {
      let black = nodePattern(P, "black");
      let red = nodePattern(P, "red", nodePattern(G, "black"));
      return new Switch(parent, insrn.toToks({ on: topNode, by: "parent" }), [
         ["empty", args.empty],
         [black, args.black],
         [red, args.red],
      ]);
   }

   export function makeProc(name: string, args: string[], img: State): Proc {
      let header: Toks = [[name, ID]];
      header = header.concat(insrn.mkList(args.map(a => [[a, ID]] as Toks)))
      let info = new ProcInfo(header, [], img);
      let ret = new bl.Proc(info) as Proc;
      return ret;
   }
}

// defines VisHost, a variant of dm.Host
// that implements all manipulation methods
// by adding instructions. 
namespace ins {
   type TokParam = insrn.TokParam;
   export abstract class VisHost extends dm.Host {
      // where instructions are found and added to.
      abstract get code(): ins.Host;
      // child is defined as the state of whatever
      // is selected in the code host. 
      get child(): [dm.Root, dm.Address] {
         let selected = this.code.selected;
         let state = selected ? selected.state : null;
         if (!state)
            return null;
         return [state, state.addr];
      }
      // we can't even edit an image if the current
      // selected instruction cannot be edited (nowhere to add the new instruction).
      checkEdit() {
         let ins = this.code.selected;
         if (!ins)
            return false;
         if (!ins.parent.canEdit(ins))
            return false;
         return super.checkEdit();
      }
      // a utility function for any manipulation that
      // can add itself to the selected instruction
      private addTo(callName: string, tokP: TokParam, state: State): rn.Undo | false {
         let oldIns = this.code.selected;
         // can only add to if the same call is being generated. 
         if (!(oldIns instanceof Simple) || oldIns.callName != callName)
            return false;
         // setup delete current can instruction.
         let del = oldIns.parent.canDelete(oldIns);
         if (!del) // must not fail, or we couldn't be editing here. 
            throw new Error();
         // compute deletion. 
         let undoA = del();
         // form replacement instruction, which has all of the deleted instruction plus a new argument. 
         let newIns = new Simple(oldIns.parent, state, oldIns.callName, oldIns.args.concat(tokP), oldIns.assign, oldIns.extra);
         (newIns.index == oldIns.index).assert();
         // complete the add. 
         let undoB = this.code.completeAdd(newIns);
         return () => {
            // both the delete and add are undoable, just undo in reverse. 
            undoB();
            undoA();
         };
      }
      // for flipColor and flipAxis. 
      private flip(
         addr: dm.NodeAddress, callName: string, 
         // initial modification.
         fA: (addr: dm.NodeAddress) => dm.NodeAddress, 
         // to generate new simple instruction if selected one isn't the same. 
         fB: (parent: ins.Block, img: ins.State, args: TokParam[]) => ins.Instruction): rn.Do {
         return () => {
            let addr0 = fA(addr);
            let undo = this.addTo(callName, addr.image.name, addr0.root);
            if (undo)
               return [undo, addr0];
            let newIns = fB(this.code.selected.parent, addr0.root, [addr.image.name]) as Simple;
            (newIns.callName == callName).assert();
            return [this.code.completeAdd(newIns), addr0];
         }
      }

      tryFlipColor(addr: dm.NodeAddress): false | rn.Do {
         return this.flip(addr, "flipColor", a => a.image.doFlipColor(a), flipColor);
      }
      tryFlipAxis(addr: dm.NodeAddress): false | rn.Do {
         return this.flip(addr, "flipAxis", a => a.image.doFlipAxis(a), flipAxis);
      }
      tryRotateUp(addr: dm.NodeAddress): false | rn.Do {
         let f0 = addr.image.tryRotateUp(addr);
         if (!f0)
            return false;
         let f = f0;
         return () => {
            let addr0 = f();
            let at = this.code.selected;
            let newIns = rotateUp(at.parent, addr0.root, addr.image.name);
            return [this.code.completeAdd(newIns), addr0];
         }
      }
      tryCompress(addr: dm.NodeAddress | dm.RootParentAddress): false | rn.Do {
         let f0: false | (() => dm.Address);
         let tok: TokParam;
         if (addr.image instanceof dm.Node) {
            f0 = addr.image.tryCompress(addr as dm.NodeAddress);
            tok = addr.image.name;
         } else {
            f0 = addr.image.tryCompress(addr as dm.RootParentAddress);
            tok = { on: addr.image.child.name, by: "parent" };
         }
         if (!f0)
            return false;
         let f = f0;
         return () => {
            let addr0 = f();
            // try adding to existing instruction first. 
            let undo = this.addTo("compress", tok, addr0.root);
            if (undo)
               return [undo, addr0];
            let newIns = compress(this.code.selected.parent, addr0.root, [tok]);
            (newIns.callName == "compress").assert();
            return [this.code.completeAdd(newIns), addr0];
         }
      }

      tryHeightVar(addr: dm.LeafAddress | dm.RootParentAddress): false | rn.Do {
         if (addr.image.height == "empty")
            return false;
         else if (addr.image.height.tag == "var")
            return false;
         return () => {
            let at = this.code.selected;
            let arg: TokParam;
            if (addr.image instanceof dm.Leaf) {
               let nA = addr.previous.image.name;
               (addr.at.name == "left" || addr.at.name == "right").assert();
               arg = { on: nA, by: addr.at.name as "left" | "right" };
            } else {
               let nA = addr.image.child.name;
               arg = { on: nA, by: "parent" };
            }
            if (at instanceof Simple && at.callName == "heightVar") {
               // if existing call is for heightVar, reuse that introduced variable
               // and concrete value. 
               let v = at.assign;
               let n = at.extra as number;
               (typeof n == "number").assert();
               let ff = addr.image.addHeightVar(addr, v, n);
               if (!ff)
                  throw new Error();
               let addr0 = ff();
               let undo = this.addTo("heightVar", arg, addr0.root);
               if (!undo) // we already verified this. 
                  throw new Error();
               return [undo, addr0];
            } else {
               // add new heightVar call with fresh heightVar variable. 
               let v = addr.root.freshHeightName("k");
               let n = (addr.image.height as dm.HeightConcrete).concrete;
               let ff = addr.image.addHeightVar(addr, v, n);
               if (!ff)
                  throw new Error();
               let addr0 = ff();
               let newIns = heightVar(at.parent, addr0.root, v, n, [arg]);
               (newIns.callName == "heightVar").assert();
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
            let [U] = addr.root.freshNodeName(["U"]);
            let result = f(U);
            let newIns: Switch;
            let addr0: dm.NodeAddress | dm.LeafAddress;
            // two kinds of results are possible depending on if leaf is black or leaf is unknown.
            if (result.tag == "black") {
               newIns = expandBlack(at.parent, on, U, result.node.root, result.empty ? result.empty.root : null);
               addr0 = result.node;
            } else {
               newIns = expandUnknown(at.parent, on, U, result.black.root, result.red.root);
               addr0 = result.black;
            }
            return [this.code.completeAdd(newIns), addr0];
         }
      }
      tryExpandRoot(addr: dm.RootParentAddress): false | rn.Do {
         let f0 = addr.image.tryExpand(addr);
         if (!f0)
            return false;
         let f = f0;
         return () => {
            let at = this.code.selected;
            // introduce parent and grandparent nodes to cover the last two cases. 
            let [P, G] = addr.root.freshNodeName(["P", "G"]);
            let result = f(P, G);
            let newIns = expandRoot(at.parent, addr.child.image.name, P, G, {
               empty: result.empty.root, black: result.black.root, red: result.red.root
            });
            let addr0 = result.empty;
            return [this.code.completeAdd(newIns), addr0];
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
               // use alpha as a default axis variable. 
               let axisV = fromAddr.image.axis.isVar() ? fromAddr.image.axis.varName : fromAddr.root.freshAxisName("𝛼");
               let ret = f(axisV);
               let newIns = compareAxis(at.parent, fromAddr.image.name, intoAddr.image.name, axisV, ret.unflipped.root, ret.flipped.root);
               let addr0 = ret.unflipped;
               return [this.code.completeAdd(newIns), addr0];
            }
         }
      }



   }
}
// final glue and driver. 
namespace insmain {
   class VisHost extends ins.VisHost {
      constructor(readonly parent: Split, readonly code: CodeHost) {
         super();
      }
      get offset() { return (100).vec(); }
   }
   class CodeHost extends ins.Host {
      constructor(readonly parent: Split, readonly root: ins.Proc) {
         super();
      }
   }
   class Split extends rn.Split {
      readonly left: CodeHost;
      readonly right: VisHost;
      constructor(readonly parent: ui2.Top, root: ins.Proc) {
         super();
         this.left = new CodeHost(this, root);
         this.right = new VisHost(this, this.left);
      }
   }
   export function main() {
      let empty = new dm.Leaf(dm.BaseHeight.concrete(1), "black");
      let N = new dm.Node("N", "red", dm.Axis.Wild, empty, empty);
      let R = new dm.RootParent(N, empty.height);
      let proc = ins.makeProc("insertRB", ["T", "V"], dm.JustTree);
      // prime the code with binary insert. 
      proc.addInstruction(new ins.Simple(proc, R, "binaryInsert", ["T", "V"], "N"));


      let top = ui2.Top.useWindow();
      top.child = new Split(top, proc);
      top.renderAll();

   }



}


