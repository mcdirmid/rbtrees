// final file, ties blocks.ts with vis.ts together (and indireclty domain.ts). 
// basically fills out line and blocks with RB tree syntax highlighted code.
// Adds this code by filling out Host from vis.ts so they are driven by manipulations
// of RB tree images. 
namespace ins {
   export type Toks = insrn.Toks;
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
      abstract get proc(): Proc;
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
      highlightFor(tok: [string, TokKind]): ({
         readonly font?: Font,
         readonly fill?: RGB,
      }) {
         let ret = this.highlight0.get(tok[1]);
         if (tok[1] == LB && this.selected instanceof Goto) {
            let other = "L" + this.selected.parent.proc.gotos.get(this.selected.target)[0];
            if (other == tok[0])
               return {
                  font: ret.font,
                  fill: RGB.orangered,
               }
         }
         return ret;
      }
      get selected() { return super.selected as Line; }
      set selected(value: Line) { super.selected = value; }
      // generates an undo for an instruction add. 
      completeAdd(ins: Instruction): rn.Undo {
         ins.addInstruction();
         let undo = ins instanceof Goto ? this.doSelect(ins) : this.doSelectNextEdit(ins);
         return () => {
            undo();
            let del = ins.canDelete();
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
            ["return", () => {
               if (!this.selected || !this.selected.canEdit())
                  return false;
               let state = this.selected.state;
               if (!state)
                  return false;
               if (this.proc.info.returnState) {
                  let unify = state.checkUnify(this.proc.info.returnState);
                  unify = unify ? unify : this.proc.info.returnState.checkUnify(state);
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
      protected cleanupPress() { 
         super.cleanupPress();
         if (this.selected instanceof Goto && this.selected.newAdd) {
            this.selected.newAdd = false;
            this.doSelectNextEdit(this.selected);
         }
      }
   }
   // upgrade Context with Host's new type.
   export interface Context extends bl.Context {
      readonly host: Host;
   }

   // all blocks have headers with keywords (proc, case, etc...).
   // they also have a state for the header (e.g. proc's input state, a state for each case).
   abstract class BlockInfo extends Object implements bl.BlockInfo {
      isClosed(): false | "broken" | "notbroken" {
         if (this.instructions.length == 0)
            return false; // no instructions, control flow is unspecified (false)
         let last = this.instructions.last();
         if (last instanceof Break) {
            // a break, so control flow is broken if it doesn't fail otherwise. 
            return "broken";
         } else if (last instanceof Goto || last instanceof Return)
            // "notbroken" control flow.
            return "notbroken";
         // ends in a switch, this is only proper if the switch itself is "notbroken".
         else if (last instanceof Switch && last.isClosed() == "notbroken")
            return "notbroken";
         else return false;
      }
      abstract get headerKw(): string;
      constructor(readonly headerToks: Toks, readonly headerState: State) {
         super();
      }
      renderHeader(header: Header, rect: Rect2D, txt: Context): void {
         let toks = ([[this.headerKw + " ", KW]] as Toks).concat(this.headerToks);
         let lbl = header.parent.proc.labelFor(header);
         if (lbl) // if target of goto, render assigned label here so we know where goto is going. 
            toks = toks.concat([[" - ", SN], [lbl, LB]])
         insrn.doRenderLine(header, rect, toks, txt);
      }
      readonly instructions = new Array<Instruction>();
   }
   export class CaseInfo extends BlockInfo { get headerKw() { return "case"; } }
   export class ProcInfo extends BlockInfo implements bl.ProcInfo {
      get headerKw() { return "proc"; }
      constructor(headerToks: Toks, readonly footerToks: Toks, headerState: State) {
         super(headerToks, headerState);
      }
      renderFooter(footer: Footer, rect: Rect2D, txt: Context): void {
         insrn.doRenderLine(footer, rect, [["end" + this.headerKw, KW]], txt);
      }
      lineHeight(txt: Context) { return txt.g.fontHeight(); }
      returnState0?: State;
      get returnState() { return this.returnState0; }
      // track returns of procedure. 
      readonly returns = new Set<Return>();
   }
   // upgraded types. 
   export interface BaseLine extends bl.BaseLine {
      readonly self: Line;
      readonly state?: State;
      readonly parent: Block;
   }
   export interface Header extends bl.Header, bl.BaseLine, BaseLine {
      readonly self: this;
      readonly state?: State;
      readonly parent: Block;
   }
   export interface Footer extends bl.Footer, bl.BaseLine, BaseLine {
      readonly self: this;
      readonly state?: State;
      readonly parent: Block;
      canDelete(): false;
   }
   export type Line = Instruction | Header | Footer;
   // finally, an implementation of instruction; nothing amazing here, just record indices,
   // have a state that will be specified somewhere else, and basic rendering 
   export abstract class Instruction extends bl.Instruction implements BaseLine {
      get self(): this { return this; }
      readonly index: number;
      abstract get state(): State;
      constructor(readonly parent: Block) {
         super();
         this.index = parent.info.instructions.length;
      }
      protected abstract get toks(): Toks;
      renderLine(rect: Rect2D, txt: Context): void {
         let toks = this.toks;
         let lbl = this.parent.proc.labelFor(this);
         if (lbl) // add label if instruction is target of goto.
            toks = toks.concat([[" - ", SN], [lbl, LB]])
         insrn.doRenderLine(this, rect, toks, txt);
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
   export type TokKind = ins.TokKind;
   export type Context = ins.Context;

   // a list of tokens as (string, token kind) pairs.
   export type Toks = [string, TokKind][];
   // render a list of tokens using host specified formatting. 
   export function doRenderLine(line: ins.Line, rect: Rect2D, toks: [string, TokKind][], txt: Context) {
      let x = 0;
      for (let [s, tk] of toks) {
         let hl = txt.host.highlightFor([s, tk]);
         txt.g.fillText(s, rect.min.addX(x), hl);
         x += txt.g.textWidth(s, hl.font);
      }
      if (!(line instanceof bl.Footer) && !(line as bl.Instruction).isPassThroughState) {
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
         let doTarget = !doGoto && txt.host.selected instanceof ins.Goto && txt.host.selected.target == line;

         let p0 = (rect.max.x - txt.SW * 3).vec(rect.min.y + 2);
         let p1 = (p0.x + txt.SW).vec(rect.max.y - 2);
         let rect0 = p0.rect(p1);
         txt.fillRect(rect0, doGoto ? RGB.dodgerblue.alpha(.5) : doTarget ? RGB.forestgreen.alpha(.5) : null, {
            label: "goto",
            addr: line.addr,
            acts: [
               ["target", () => {
                  if (!doGoto)
                     return false;
                  return (m) => {
                     if (m instanceof bl.BaseLine && !(m as bl.Instruction).isPassThroughState) {
                        let other = m as ins.Instruction | ins.Header;
                        if (line.state.checkUnify(other.state))
                           return () => {
                              let goto = new ins.Goto(line.parent, other);
                              if (other.isAfter(line))
                                 goto.isInvisible = true;
                              let undo = txt.host.completeAdd(goto);
                              let ret : [rn.Undo, rn.Address] = [undo, null];
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
   // produces syntax of the form Node(red, P = Node(black))
   // used in case headers as pattern matches during expansions. 
   export function nodePattern(nm: string, clr: "red" | "black" | "unknown", parent?: Toks): Toks {
      let args: Toks[] = [];
      args.push([[clr, ins.KW]]);
      if (parent)
         args.push(parent);
      let ret: Toks = [["Node", ins.ID]];
      ret = ret.concat(insrn.mkList(args));
      return insrn.assign(nm, ret);
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
      constructor(parent: Block, readonly on: Toks, cases: [Toks, State][]) {
         super(parent);
         this.cases = bl.initCases(this,
            cases.map(([param, image]) => new CaseInfo(insrn.toToks(param), image))) as Case[];
      }
      renderFooter(rect: Rect2D, txt: Context): void {
         insrn.doRenderLine((this as bl.Switch).footer as Line, rect, [["endswitch", KW]], txt);
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
            let result = b.info.isClosed();
            if (!result)
               return false;
            else if (result == "broken")
               broken = "broken";
            else continue; // not broken but terminating. 
         }
         return broken;
      }
      // something can follow the switch only if its control flow is broken. 
      footerCanEdit(): boolean { return this.isClosed() == "broken"; }
      get toks() { return ([["switch ", KW]] as Toks).concat(this.on); }
   }
   // a basic goto that goes from one similar state to another similar state. 
   // used to economize instructions (we've seen this already) and also to form
   // loops (where the end and head of a loop must be similar unifiable states).
   export class Goto extends PassThrough implements bl.Goto {
      isInvisible : boolean = false;
      newAdd: boolean = true;
      get state() { return this.target.state; }
      get toks(): Toks {
         let ret = this.unify.renderToks();
         ret.unshift(["goto", KW], [
            " L" + this.parent.proc.gotos.get(this.target)[0].toString(), LB
         ]);
         return ret;
      }
      private get unify() {
         let unify = super.state.checkUnify(this.target.state);
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
         if (!unify) {
            let unify = this.state.checkUnify(top.info.returnState0);
            throw new Error();
         }
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
}
// functions for producing simple and switch instructions based on domain manipulations.
namespace ins {
   type TokParam = insrn.TokParam;
   export function flipColor(parent: Block, state: State, args: TokParam[]) {
      return new Simple(parent, state, "flipColor", args);
   }
   export function doDelete(parent: Block, state: State, arg: string) {
      return new Simple(parent, state, "delete", [arg]);
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
      let on = insrn.assign(varName,
         insrn.toToks("compareAxis").concat(insrn.mkList([nA, nB])),
      )
      return new Switch(parent, on, [
         [insrn.toToks(true), unflipped],
         [insrn.toToks(false), flipped],
      ]);
   }
   export function expandUnknown(parent: Block, on: { on: string, by: "left" | "right" }, nA: string, onBlack: State, onRed: State) {
      let black = ([] as Toks).concat(insrn.toToks("Leaf")).concat(insrn.mkList(["black"]));
      let red = insrn.nodePattern(nA, "red");
      return new Switch(parent, insrn.toToks(on), [
         [black, onBlack], [red, onRed],
      ]);
   }
   export function expandBlack(parent: Block, on: { on: string, by: "left" | "right" }, nA: string, onNode: State, onEmpty?: State) {
      let node = insrn.nodePattern(nA, "black");
      let empty = onEmpty ? insrn.toToks("empty") : null;
      let cases: [Toks, State][] = [[node, onNode]];
      if (empty)
         cases.push([empty, onEmpty]);
      return new Switch(parent, insrn.toToks(on), cases);
   }
   export function expandRoot(parent: Block, topNode: string, P: string, G: string, args: {
      empty: State, black: State, red: State,
   }) {
      let black = insrn.nodePattern(P, "black");
      let red = insrn.nodePattern(P, "red", insrn.nodePattern(G, "black"));
      return new Switch(parent, insrn.toToks({ on: topNode, by: "parent" }), [
         [black, args.black],
         [red, args.red],
         [insrn.toToks("empty"), args.empty],
      ]);
   }
   export function expandRootA(parent: Block, topNode: string, P: string, args: {
      empty: State, notEmpty: State,
   }) {
      let unknown = insrn.nodePattern(P, "unknown");
      return new Switch(parent, insrn.toToks({ on: topNode, by: "parent" }), [
         [unknown, args.notEmpty],
         [insrn.toToks("empty"), args.empty],
      ]);
   }
   export function expandRootB(parent: Block, topNode: string, G: string, args: {
      black: State, red: State,
   }) {
      let black = insrn.nodePattern(topNode, "black");
      let red = insrn.nodePattern(topNode, "red", insrn.nodePattern(G, "black"));
      return new Switch(parent, insrn.toToks(topNode), [
         [black, args.black],
         [red, args.red],
      ]);
   }

   export function makeProc(name: string, args: string[], img: State): Proc {
      let header: Toks = [[name, ID]];
      header = header.concat(insrn.mkList(args.map(a => [[a, ID]] as Toks)))
      let info = new ProcInfo(header, [], img);
      let ret = new bl.Proc(info) as Proc;
      ret.states.add(ret.header as ins.Header)
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
      get root(): dm.Root {
         let selected = this.code.selected;
         let state = selected ? selected.state : null;
         return state;
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
      // a utility function for any manipulation that
      // can add itself to the selected instruction
      private addTo(callName: string, tokPS: TokParam[], state: State): rn.Undo | false {
         let oldIns = this.code.selected;
         // can only add to if the same call is being generated. 
         if (!(oldIns instanceof Simple) || oldIns.callName != callName)
            return false;
         // setup delete current can instruction.
         let del = oldIns.canDelete();
         if (!del) // must not fail, or we couldn't be editing here. 
            throw new Error();
         // compute deletion. 
         let undoA = del();
         // form replacement instruction, which has all of the deleted instruction plus a new argument. 
         let newIns = new Simple(oldIns.parent, state, oldIns.callName, oldIns.args.concat(tokPS), oldIns.assign, oldIns.extra);
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
         fA: (addr: dm.NodeAddress) => (false | (() => dm.NodeAddress)),
         // to generate new simple instruction if selected one isn't the same. 
         fB: (parent: ins.Block, img: ins.State, args: TokParam[]) => ins.Instruction): rn.Do | false {
         let fA0 = fA(addr);
         if (!fA0)
            return false;
         let fA1 = fA0;
         return () => {
            let addr0 = fA1();
            let undo = this.addTo(callName, [addr.image.name], addr0.root);
            if (undo)
               return [undo, addr0];
            let newIns = fB(this.code.selected.parent, addr0.root, [addr.image.name]) as Simple;
            (newIns.callName == callName).assert();
            return [this.code.completeAdd(newIns), addr0];
         }
      }

      tryFlipColor(addr: dm.NodeAddress): false | rn.Do {
         return this.flip(addr, "flipColor", a => a.image.tryFlipColor(a), flipColor);
      }

      tryFlipAxis(addr: dm.NodeAddress): false | rn.Do {
         return this.flip(addr, "flipAxis", a => () => a.image.doFlipAxis(a), flipAxis);
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
      tryDelete(addr: dm.NodeAddress): false | rn.Do {
         let f0 = addr.image.tryDelete(addr);
         if (!f0)
            return false;
         let f = f0;
         return () => {
            let at = this.code.selected;
            let addr0 = f();
            let newIns = doDelete(at.parent, addr0.root, addr.image.name);
            return [this.code.completeAdd(newIns), addr0];
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
            let [addr0, nS] = f();


            // try adding to existing instruction first. 
            let undo = this.addTo("compress", nS.map(n => n.name), addr0.root);
            if (undo)
               return [undo, addr0];
            let newIns = compress(this.code.selected.parent, addr0.root, nS.map(n => n.name));
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
               let undo = this.addTo("heightVar", [arg], addr0.root);
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
            let [U] = addr.root.freshNodeName([addr.previous.image.name == "G" ? "U" : "S"]);
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
            let newIns = expandRoot(at.parent, addr.child.image.name, P, G, {
               empty: result.empty.root, black: result.black.root, red: result.red.root
            });
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
            let newIns = expandRootA(at.parent, addr.child.image.name, P, {
               notEmpty: result.notEmpty.root, empty: result.empty.root,
            });
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
            if (at instanceof bl.Header && at.parent instanceof bl.Case) {
               let caze = at.parent;
               let zwitch = caze.parent;
               if (zwitch.on.length == 3 && zwitch.on[2][0] == "parent" && addr.child.left.image instanceof dm.Node && zwitch.on[0][0] == addr.child.left.image.name) {
                  let other = zwitch.cases.find(c => c != caze) as bl.Case;
                  let del = at.canDelete();
                  if (del) {
                     let undoA = del();
                     let newIns = expandRoot(zwitch.parent, addr.child.left.image.name, addr.child.image.name, G, {
                        black: result.black.root,
                        red: result.red.root,
                        empty: other.header.state as dm.Root,
                     });
                     let undoB = this.code.completeAdd(newIns);
                     let addr0 = result.black;
                     return [() => {
                        undoB();
                        undoA();
                     }, addr0];

                  }
               }
            }
            let newIns = expandRootB(at.parent, addr.child.image.name, G, {
               black: result.black.root, red: result.red.root,
            });
            let addr0 = result.black;
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
      constructor(readonly parent: Split, readonly proc: ins.Proc) {
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
   export function mainInsert() {
      let empty = new dm.Leaf(dm.BaseHeight.concrete(1), "black", false);
      let N = new dm.Node("N", "red", dm.Axis.Wild, empty, empty);
      let R = new dm.RootParent(N, empty.height, false);
      let proc = ins.makeProc("rbInsert", ["T", "V"], dm.JustTree);
      // prime the code with binary insert. 
      (new ins.Simple(proc, R, "binInsert", ["T", "V"], "N")).addInstruction();


      let top = ui2.Top.useWindow();
      top.child = new Split(top, proc);
      top.renderAll();

   }
   export function mainDelete() {
      let proc = ins.makeProc("rbDelete", ["T", "V"], dm.JustTree);
      // prime the code with binary insert. 
      let empty = new dm.Leaf(dm.BaseHeight.concrete(1), "black", false);
      let N = new dm.Node("N", "unknown", dm.Axis.Wild, empty, new dm.Leaf(dm.BaseHeight.concrete(1), "unknown", true));
      let R = new dm.RootParent(N, empty.height.add(1), true);
      (new ins.Simple(proc, R, "binDelete", ["T", "V"], "N")).addInstruction();
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



      let proc = ins.makeProc("rbRebalance", ["T"], R);
      // prime the code with binary insert. 
      let top = ui2.Top.useWindow();
      top.child = new Split(top, proc);
      top.renderAll();
   }



}


