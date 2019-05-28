// This file defines a way to express manipulations basically
// as code. 

// this first small package provides a way to organize state via a hash. 
namespace bl {
   export interface State {
      // a hash to find similar states quickly.
      readonly hash: string;
      // performs unification from this state into another state
      // (order is important). Fails with false or returns a unification
      // object. 
      checkUnify(into: State): Unify | false;
   }
   export interface Unify { }
   // remember and retrieve images and date by hash/unify. 
   export class HashUnify<U extends Unify, T extends {
      readonly state?: State;
      readonly isPassThroughState?: true;
   }> {
      private readonly map = new Map<string, Set<T>>();

      add(value: T) {
         if (value.isPassThroughState)
            return;
         let state = value.state;
         if (!state)
            return;
         let hash = state.hash;
         let map0 = this.map.getOrSet(hash, () => new Set<T>());
         (!map0.has(value)).assert();
         map0.add(value);
      }
      delete(value: T): void {
         if (value.isPassThroughState)
            return;
         let state = value.state;
         if (!state)
            return;
         this.map.get(state.hash).delete(value).assert();
      }
      lookup(state: State): [U, T][] {
         let hash = state.hash;
         let map0 = this.map.get(hash);
         if (!map0)
            return [];
         let ret: [U, T][] = [];
         for (let value of map0) {
            let into = value.state;
            let result = state.checkUnify(into) as U;
            if (!result)
               continue;
            ret.push([result, value]);
         }
         return ret;
      }
   }
}

// this namespace defines line and block structure for code.
// a block is indented (python style) with a header and footer,
// each block contains many instructions, headers, footers, and
// instructions are referred to as lines. 
namespace bl {
   // a base line, either an instruction, header or footer. 
   export interface BaseLine {
      // all lines have block parents. 
      readonly parent: Block;
      // lines are rendered without being full rn.Images.
      renderLine(pos: Vector2D, txt: Context): void;
      // lines possibly have state. 
      readonly state?: State;
   }
   export type Line = Instruction | Header | Footer;
   // an instruction is a line that is explicitly added to a block. 
   export interface Instruction extends BaseLine {
      // index in parent block, will never move.
      readonly index: number;
      // if this instruction is a branch to another line. 
      readonly isPassThroughState?: true;
      // optional methods to extend what happens
      // when instruction is removed or added.
      addInner?(): void;
      deleteInner?(): void;
   }
   // base of header or footer, neither of which is
   // exposed outside of this namespace so does
   // not need to be exported. How they behave.
   abstract class HeaderFooter<T> extends Object implements BaseLine {
      abstract get adbg(): string;
      abstract get parent(): Block;
      constructor(readonly owner: T) { super(); }
      abstract renderLine(pos: Vector2D, txt: Context): void;
   }
   export class Header extends HeaderFooter<Block> {
      get parent() { return this.owner; }
      get adbg(): string { return "header-" + this.parent.adbg; }
      // delegate header rendering to block's parameterized info.
      renderLine(pos: Vector2D, txt: Context): void { return this.parent.info.renderHeader(this, pos, txt); }
   }
   export class Footer extends HeaderFooter<Proc | Switch> {
      get parent() { return this.owner instanceof Proc ? this.owner : this.owner.parent; }
      get adbg(): string { return "footer-" + this.owner; }
      renderLine(pos: Vector2D, txt: Context): void {
         // again, delegate to either proc or switch owner of footer
         // for rendering.
         if (this.owner instanceof Proc)
            return this.owner.info.renderFooter(this, pos, txt);
         else this.owner.renderFooter(pos, txt);
      }
   }
   // state is optional (off the books), so use reflection
   // to define rather than causing interface confusion. 
   interface HeaderFooter<T> {
      readonly state?: State;
   }
   Object.defineProperty(Header.prototype, "state", {
      get: function () {
         let self = this as Header;
         return self.owner.info.headerState;
      }, enumerable: true, configurable: true,
   })
   Object.defineProperty(Footer.prototype, "state", {
      get: function () {
         let self = this as Footer;
         return self.owner instanceof Proc ?
            self.owner.info.returnState :
            self.owner.breakState;
      }, enumerable: true, configurable: true,
   })


   // private line address used to implelment selection, 
   // just pass through identity since lines are persistant and
   // mutable. 
   class LineAddress extends Object implements rn.Address {
      get adbg() { return this.line.parent.adbg + ":" + this.line; }
      constructor(readonly line: Line) {
         super();
      }
      equals(other: rn.Address): boolean {
         return other instanceof LineAddress && this.line == other.line;
      }
      isNestedIn(other: rn.Address) { return this.equals(other); }
   }

   export type Block = (Case | Proc);
   // like headers and footers, clients do not implement/extend blocks. 
   // they customize by implementing BlockInfo/ProcInfo.
   // BaseBlock is the main workhorse of this module.
   // blocks are also images as far as rendering is concerned, but
   // since they are mutable their sizes must be invalidated on mutation.
   export abstract class BaseBlock extends Object implements rn.Image {
      readonly header: Header;
      abstract get info(): BlockInfo;
      abstract get adbg(): string;
      abstract get parentBlock(): Block | null;
      constructor() {
         super();
         this.header = new Header(this as any as Block);
      }
      toString() { return this.adbg; }
      get proc(): Proc {
         let b = this as any as Block;
         while (b.parentBlock)
            b = b.parentBlock;
         return b as Proc;
      }
      size?: Vector2D;
      // invalidate method to nuke size when 
      // block is mutated. 
      invalidate(): void {
         if (this.size) {
            delete this.size;
            if (this.parentBlock)
               this.parentBlock.invalidate();
         }
      }
      // render each line beyond the line's intrinsic rendering. 
      // manages selection input/highlighting, as well as 
      // rendering case blocks and rendering a footer if necessory
      // for a switch line.  
      private renderLine(line: Line, pos: Vector2D, txt: Context, lh: number, sp: number): number {
         (line.parent as BaseBlock == this).assert();
         // we need a rectangle that extends to size of host
         let px = txt.peekTranslation().x;
         let rect = pos.addX(-txt.SW / 2).rect((txt.host.size.minus(txt.host.offset).x - px).vec(pos.y + lh + sp))
         txt.fillRect(rect, txt.host.selected == line ? RGB.dodgerblue.alpha(.1) : null, {
            addr: new LineAddress(line),
            label: "line",
            acts: [
               ["scrub", () => (m: LineAddress) => {
                  return () => txt.host.selected = m.line;
               }],
            ]
         });
         line.renderLine(pos.addY(sp), txt);
         // highlight lines that can be edited or deleted. 
         let canEdit = line.parent.canEdit(line);
         let canDel = canEdit ? false : line.parent.canDelete(line) != false;
         if (canEdit || canDel) {
            let cx = rect.max.x - txt.SW;
            let cy = pos.y + (lh + sp) / 2;
            txt.fillSmallCircle(cx.vec(cy), canEdit ? RGB.orangered : RGB.grey);
         }
         let dy = lh + sp;
         let zwitch = line as Switch;
         if (zwitch.cases) {
            for (let b of zwitch.cases) {
               txt.renderImage(b, pos.addY(dy));
               dy += b.size.y;
            }
            if (!zwitch.footer)
               (zwitch as any).footer = new Footer(zwitch);
            dy += this.renderLine(zwitch.footer, pos.addY(dy), txt, lh, sp);
         }
         return dy;
      }
      // render block core, just put out header, indent, then instructions.
      // and maybe a footer
      renderCore(txt: Context): Vector2D {
         let y = 0;
         let lh = this.proc.info.lineHeight(txt);
         lh = Math.ceil(lh * 1);
         let sp = Math.ceil(lh * .1);
         y += this.renderLine(this.header, (0).vec(y), txt, lh, sp);
         let yh = y;
         let x = txt.SW;
         if (this.info.instructions.length == 0)
            y += (lh + sp) / 2;
         for (let line of this.info.instructions)
            y += this.renderLine(line, x.vec(y), txt, lh, sp);
         txt.g.strokeLine([(x / 2).vec(yh), (x / 2).vec(y)]);
         if (this instanceof Proc)
            y += this.renderLine(this.footer, (0).vec(y), txt, lh, sp);
         return (100000).vec(y);
      }
      // determine whether or not line can be edited.
      // Lines can only be edited if they are the "end" of
      // something where new lines can be added afterwards.
      canEdit(line: Line): boolean {
         // a header can only be edited off of if there
         // are instructions in the block it is heading.
         if (line instanceof Header)
            return line.parent.info.instructions.length == 0;
         else if (line instanceof Footer) {
            // a footer can only be edited off of if it is owned
            // by a switch and that switch is the last instruction
            // of its block. 
            if (line.owner instanceof Proc)
               return false;
            else if (line.owner.index != line.owner.parent.info.instructions.length - 1)
               return false;
            // a footer also cannot be edited if no control flow exists the switch,
            // which is determined later in instrucitons.ts. 
            else if (line.owner.footerCanEdit && !line.owner.footerCanEdit())
               return false;
            else return true;
            // an instruction can be edited if (a) it is the last one in its block and (b)
            // it doesn't receive its state from the previous instruction (like branches do).
         } else if (line.index != line.parent.info.instructions.length - 1 || line.isPassThroughState)
            return false;
         else return true;
      }
      // returns the next line for a block that has ended.
      private nextAsBlock(): Header | Footer {
         if (this instanceof Case) {
            // for a case block, this is the header for the next block,
            // or the switch line's footer. 
            (this.parent.footer != null).assert();
            if (this.index < this.parent.cases.length - 1)
               return this.parent.cases[this.index + 1].header;
            else return this.parent.footer;
            // this is the footer of the proc. 
         } else return (this as any as Proc).footer;
      }
      // returns the next line for an instruction.
      private nextAsInstruction(ins: Instruction) {
         (ins.parent as BaseBlock == this).assert();
         // if the instruction is not the last, this is just 
         // the next instruction.
         if (ins.index < this.info.instructions.length - 1)
            return this.info.instructions[ins.index + 1];
         // otherwise it is the next line for the block.
         else return this.nextAsBlock();
      }
      // the line logically after "line" 
      next(line: Line): Line {
         (line.parent as BaseBlock == this).assert();
         if (line instanceof Header) {
            // for headers, if the header's block
            // has instructions, the next is the first one.
            if (this.info.instructions.length > 0)
               return this.info.instructions[0];
            // otherwise, it is whatever next is for the block.k
            else return this.nextAsBlock();
         } else if (line instanceof Footer) {
            // footer for proc has no next.
            if (line.owner instanceof Proc)
               return null;
            let zwitch = line.owner;
            (zwitch.parent as BaseBlock == this).assert();
            // otherwise, it is hte next for the footer's switch.
            return this.nextAsInstruction(zwitch);
         }
         if ((line as Switch).cases)
            // if switch, then next is the header of the switch's first block.
            return (line as Switch).cases[0].header;
         // otherwise just the next instruction. 
         return this.nextAsInstruction(line);
      }
      // the logical predecessor of "line". 
      previous(line: Line): Line {
         if (line instanceof Header) {
            if (line.owner instanceof Proc)
               return null;
            // for a header of a case block, we are deleting the entire switch,
            // so should just be the predecessor for the switch.
            else return line.owner.parent.parent.previous(line.owner.parent);
         } else if (line instanceof Footer) {
            //for a footer, the last instruction or the predecessor block header if none.
            let b = line.owner instanceof Proc ? line.owner : line.owner.cases.last();
            if (b.info.instructions.length == 0)
               return b.header;
            let prev = b.info.instructions.last() as Switch;
            return prev.cases ? prev.footer : prev;
         } else {
            if (line.index > 0) {
               // for a non-first instruction, just the previous instruction, unless
               // the previous instruction is a switch, then the switch's footer.
               let prev = line.parent.info.instructions[line.index - 1] as Switch;
               return prev.cases ? prev.footer : prev;
               // for a first instruction, the block header. 
            } else return line.parent.header;
         }
      }
      // can we delete this line, and if so, the undoable
      // action to delete. 
      canDelete(line: Line): false | (() => rn.Undo) {
         (line.parent as BaseBlock == this).assert();
         if (line instanceof Footer) // footers can never be deleted.
            return false;
         else if (line instanceof Header) {
            // a header can be deleted if it is parented by 
            // a switch and the switch can be deleted
            // (deleting the header deletes the switch,
            // which allows us to undo creating a switch
            // quickly as selection will land on a header
            // after the switch is created).
            if (this instanceof Case && this.index == 0)
               return this.parent.parent.canDelete(this.parent);
            else return false;
         } else if (line.index < this.info.instructions.length - 1)
            // non-last instructions cannot be deleted.
            return false;
         else {
            let zwitch = line as Switch;
            // switches can only be deleted if all their case blocks are empty.
            if (zwitch.cases && zwitch.cases.some(b => b.info.instructions.length > 0))
               return false;
            let ins = line;
            return () => this.deleteInstruction(ins);
         }
      }
      // called to add or re-add an instruction. 
      addInstruction(ins: Instruction) {
         // block and all parents must be invalidated because adding an
         // instruction will change its size. 
         this.invalidate();
         (ins.index == this.info.instructions.length).assert();
         this.info.instructions.push(ins);
         // register instruction's state for later lookup.
         this.proc.states.add(ins);
         let goto = ins as Goto;
         // goto targets must also be registered. 
         if (goto.target) {
            let proc = this.proc;
            let [idx, gotos] = proc.gotos.getOrSet(goto.target, () => {
               let idx = proc.labels.length;
               proc.labels.push(goto.target);
               return [idx, new Set<Goto>()];
            });
            gotos.add(goto);
         }
         if (ins.addInner)
            // additional add logic based on instruction.
            ins.addInner();

      }
      // creates and returns a switch's case blocks (if creating).
      // register each case block header state for later lookup
      // (creating or re-adding).
      initCases(zwitch: Switch, infos?: BlockInfo[]) {
         let blocks = zwitch.cases;
         if (!blocks)
            blocks = infos.map((info, i) => new Case(zwitch, i, info));
         for (let b of blocks)
            this.proc.states.add(b.header);
         return blocks;
      }
      // called to remove instruction from code,
      // is undoable. 
      deleteInstruction(ins: Instruction): rn.Undo {
         // must be last instruction.
         (this.info.instructions.last() == ins).assert();
         this.info.instructions.pop();
         // invalidate block size since it has one less instruction
         this.invalidate();
         // unregister state.
         this.proc.states.delete(ins);
         let zwitch = ins as Switch;
         for (let b of zwitch.cases ? zwitch.cases : [])
            // unregister case block header states for switches.
            this.proc.states.delete(b.header);
         let goto = ins as Goto;
         // unregister goto target.
         if (goto.target) {
            let info = ins.parent.proc;
            let [idx, gotos] = info.gotos.get(goto.target);
            gotos.delete(goto).assert();
            if (gotos.isEmpty()) {
               info.gotos.delete(goto.target);
               info.labels.splice(idx, 1);
               for (let i = idx; i < info.labels.length; i += 1) {
                  let [jdx, jumps] = info.gotos.get(info.labels[i]);
                  (jdx == i - 1).assert();
                  info.gotos.set(info.labels[i], [i, jumps]);
               }
            }

         }
         if (ins.deleteInner)
            // custom by instruction.
            ins.deleteInner();
         return () => {
            // undoing is just re-adding. 
            this.addInstruction(ins);
            if (zwitch.cases)
               this.initCases(zwitch);
         }
      }
   }

   // client implemented info for block (instructions and how to render header). 
   export interface BlockInfo {
      readonly headerState?: State;
      readonly instructions: Instruction[];
      renderHeader(header: Header, pos: Vector2D, txt: Context): void;
   }
   // the case blocks of a switch instruction.
   export class Case extends BaseBlock {
      get adbg(): string { return this.parent.parent.adbg + "." + this.parent.index + ":" + this.index; }
      constructor(readonly parent: Switch, readonly index: number, readonly info: BlockInfo) {
         super();
      }
      get parentBlock() { return this.parent.parent; }
   }


   // like block info, but for proc.
   export interface ProcInfo extends BlockInfo {
      renderFooter(footer: Footer, pos: Vector2D, txt: Context): void;
      lineHeight(txt: Context): number;
      readonly returnState?: State;
   }
   // usually a procedure's main block. 
   export class Proc extends BaseBlock {
      readonly states = new HashUnify<Unify, Instruction | Header>();
      readonly gotos = new Map<Instruction | Header, [number, Set<Goto>]>();
      readonly labels = new Array<Instruction | Header>();
      get adbg() { return "proc"; }
      readonly footer: Footer;
      constructor(readonly info: ProcInfo) {
         super();
         this.footer = new Footer(this);
      }
      // proc has no parent block.
      get parentBlock(): null { return null; }
      // compute a goto label for display purposes. 
      labelFor(ins: Instruction | Header): string | false {
         if (!this.gotos.has(ins))
            return false;
         let idx = this.gotos.get(ins)[0];
         return "L" + idx;
      }
   }
   // a switch is a branching instruction, where
   // each case block represents a different possibility.  
   export interface Switch extends Instruction {
      readonly cases: Case[];
      readonly footer?: Footer;
      renderFooter(pos: Vector2D, txt: Context): void;
      footerCanEdit?(): boolean;
      // the state of the switch that exits via break statements.
      readonly breakState?: State;
      // switch always passes through previous state. 
      readonly isPassThroughState: true;
   }
   // a goto line jumps to another line (instruction or header).
   export interface Goto extends Instruction {
      // goto always passes through previous state. 
      readonly isPassThroughState: true;
      readonly target: Instruction | Header;
   }

   // upgrading context host and getting rid of unneeded address
   // in renderImage.
   export interface Context extends rn.Context {
      readonly host: Host;
      renderImage(e: Block, pos: Vector2D): void;
   }
   // host for block needs selection and selection related functionality. 
   export abstract class Host extends rn.Host {
      abstract get root(): Proc;
      private selected0: Line;
      get selected() { return this.selected0; }
      set selected(value: Line) { this.selected0 = value; }
      get child(): [Proc, null] { return [this.root, null]; }
      // after an insertion of "next", advance selection until
      // editable line is found. 
      selectNextEdit(next: Line): rn.Undo {
         let old = this.selected;
         let orig = next;
         (next != null).assert();
         while (!next.parent.canEdit(next)) {
            let n = next.parent.next(next);
            if (!n)
               break;
            else next = n;
         }
         if (!next.parent.canEdit(next))
            next = orig;
         this.selected = next;
         return () => {
            this.selected = old;
         }
      }
      // deletion as defined before, except adjust selection
      // when deletion happens and is undone. 
      canDelete(): false | (() => rn.Undo) {
         let f0 = this.selected ? this.selected.parent.canDelete(this.selected) : false;
         if (!f0)
            return false;
         let f = f0;
         return () => {
            let save = this.selected;
            // find previous line to be new selection.
            this.selected = this.selected.parent.previous(this.selected);
            let undo = f();
            return () => {
               undo();
               // restore original selection on undo.
               this.selected = save;
            }
         }


      }
      canEdit(): boolean {
         return this.selected ? this.selected.parent.canEdit(this.selected) : false;
      }
   }
}

namespace rn {
   // a utility class used to display two hosts side by side. 
   export abstract class Split extends ui2.Elem {
      abstract get left(): Host;
      abstract get right(): Host;
      get children() { return [this.left, this.right]; }
      get inset() { return 10; }

      renderLocal(g: Render2D) {
         super.renderLocal(g);
         this.left.position = this.inset.vec();
         this.left.size = this.size.setX(g.textWidth("X", rn.font) * 30);
         this.right.position = this.left.position.addX(this.left.size.x + this.inset);
         this.right.size = this.size.addX(-this.right.position.x);
         let div = this.right.position.addX(-this.inset / 2);
         g.strokeLine([div, div.setY(this.size.y)], { stroke: RGB.black.alpha(.1), lineWidth: this.inset })
      }
   }
}




namespace bltest {
   type Block = bl.Block;
   interface Context extends bl.Context { }

   class Instruction extends Object implements bl.Instruction {
      get state(): null { return null; }
      renderLine(pos: Vector2D, txt: Context): void {
         txt.fillText(pos, this.text);
      }
      readonly index: number;
      constructor(readonly parent: Block, readonly text: string) {
         super();
         this.index = parent.info.instructions.length;
         parent.addInstruction(this);
      }
      postAdd(): this { this.parent.addInstruction(this); return this; }
   }
   class Switch extends Instruction implements bl.Switch {
      readonly blockInfo: bl.BlockInfo[] = [];
      readonly cases: bl.Case[];
      constructor(parent: Block, text: string, readonly footerText: string, headers: string[]) {
         super(parent, text);
         this.cases = parent.initCases(this, headers.map(h => new BlockInfo(h)));
      }
      renderFooter(pos: Vector2D, txt: Context): void {
         txt.fillText(pos, this.footerText);
      }
      get isPassThroughState(): true { return true; }
   }
   class BlockInfo extends Object implements bl.BlockInfo {
      readonly instructions: bl.Instruction[] = [];
      constructor(readonly header: string) {
         super();
      }
      renderHeader(header: bl.Header, pos: Vector2D, txt: Context): void {
         txt.fillText(pos, this.header);
      }
   }
   class ProcInfo extends BlockInfo implements bl.ProcInfo {
      constructor() {
         super("proc");
      }
      lineHeight(txt: Context) { return txt.g.fontHeight(); }
      renderFooter(footer: bl.Footer, pos: Vector2D, txt: Context): void {
         txt.fillText(pos, "endproc");
      }
   }
   class Host extends bl.Host {
      constructor(readonly parent: ui2.Top, readonly root: bl.Proc) {
         super();
         this.parent.child = this;
      }
      get useFont() { return rn.codeFont; }
      get offset() { return (10).vec(); }
      renderHeader(txt: Context) {
         let sz = super.renderHeader(txt);
         let sz1 = txt.buttonBar((0).vec(sz.y), [
            ["delete", () => this.canDelete()],
            ["edit", () => {
               if (!this.canEdit())
                  return false;
               return () => {
                  let old = this.selected;
                  let ins = new Instruction(this.selected.parent, "XXX");
                  this.selected.parent.invalidate();
                  this.selected = ins;
                  return () => {
                     let del = ins.parent.canDelete(ins);
                     if (!del)
                        throw new Error();
                     del();
                     this.selected = old;
                  };
               }

            }]
         ]);
         return sz.x.max(sz1.x).vec(sz.y + sz1.y);
      }
   }

   export function test() {
      let proc = new bl.Proc(new ProcInfo());
      new Instruction(proc, "hello").postAdd();
      new Instruction(proc, "world").postAdd();
      let c = new Switch(proc, "switch (x)", "endswitch", ["case1", "case2", "case3"]).postAdd();
      if (false)
         for (let b of c.cases) {
            new Instruction(b, "xxx").postAdd();
            new Instruction(b, "yyy").postAdd();
            new Instruction(b, "zzz").postAdd();
         }


      let top = ui2.Top.useWindow();
      let h = new Host(top, proc);
      top.renderAll();



   }

}

