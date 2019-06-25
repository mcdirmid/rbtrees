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
            if (into == state)
               continue;
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
   export abstract class BaseLine extends Object implements rn.Address {
      abstract get self(): Line;
      // all lines have block parents. 
      abstract get parent(): Block;
      // lines are rendered without being full rn.Images.
      abstract renderLine(rect: Rect2D, txt: Context): void;
      // is this line an end point from which a new image can be created?
      canEdit(): boolean {
         if (this.self instanceof Header || this.self instanceof Footer)
            throw new Error();
         else if (this.self.index != this.self.parent.info.instructions.length - 1 || this.self.isPassThroughState)
            return false;
         else return true;
      }
      get parentBlock(): BaseBlock { return this.self.parent; }
      // the line logically after "line" 
      get next(): Line {
         let line = this.self;
         if (line instanceof Header) {
            // for headers, if the header's block
            // has instructions, the next is the first one.
            if (line.parent.info.instructions.length > 0)
               return line.parent.info.instructions[0];
            // otherwise, it is whatever next is for the block.k
            else return line.parent.nextAsBlock();
         } else if (line instanceof Footer) {
            // footer for proc has no next.
            if (line.owner instanceof Proc)
               return null;
            let zwitch = line.owner;
            (zwitch.parent as BaseBlock == line.parent).assert();
            // otherwise, it is hte next for the footer's switch.
            return zwitch.nextAsInstruction;
         }
         if ((line as Switch).cases)
            // if switch, then next is the header of the switch's first block.
            return (line as Switch).cases[0].header;
         // otherwise just the next instruction. 
         return line.nextAsInstruction;
      }
      // returns the next line for an instruction.
      private get nextAsInstruction() {
         let ins = this.self;
         if (ins instanceof Header || ins instanceof Footer)
            throw new Error();
         // if the instruction is not the last, this is just 
         // the next instruction.
         if (ins.index < ins.parent.info.instructions.length - 1)
            return ins.parent.info.instructions[ins.index + 1];
         // otherwise it is the next line for the block.
         else return ins.parent.nextAsBlock();
      }
      // the logical predecessor of "line". 
      get previous(): Line {
         let line = this.self;
         if (line instanceof Header || line instanceof Footer)
            throw new Error();
         else {
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
      canDelete(): false | (() => rn.Undo) {
         let line = this.self;
         if (line instanceof Footer || line instanceof Header)
            throw new Error();
         else if (line.index < line.parent.info.instructions.length - 1)
            // non-last instructions cannot be deleted.
            return false;
         else {
            let zwitch = line as Switch;
            // switches can only be deleted if all their case blocks are empty.
            if (zwitch.cases && zwitch.cases.some(b => b.info.instructions.length > 0))
               return false;
            let ins = line;
            return () => ins.deleteInstruction();
         }
      }
      isParentedBy(by: Line): boolean {
         if (this.self == by)
            return false;
         else if (this.parent == by.parent) {
            if (by instanceof Header || this.self instanceof Footer)
               return true;
            else if (this.self instanceof Header || by instanceof Footer)
               return false;
            return this.self.index < by.index;
         } else if (this.parent instanceof Proc)
            return false;
         else return this.parent.parent.isParentedBy(by);
      }
      get adbg() { return this.parent.adbg + ":" + this; }
      equals(other: rn.Address): boolean { return this == other; }
      isNestedIn(other: rn.Address) { return this.equals(other); }
      get addr() { return this.self; }

      isAfter(other: Line): boolean {
         if (this.parent == other.parent) {
            if (this.self instanceof Header || other instanceof Footer)
               return false;
            else if (other instanceof Header || this.self instanceof Footer)
               return true;
            return this.self.index > other.index;
         }
         if (this.parent.depth == other.parent.depth && this.parent.depth == 0)
            return false;
         if (this.parent.depth == other.parent.depth && (this.parent as Case).parent == (other.parent as Case).parent)
            return (this.parent as Case).index > (other.parent as Case).index;
         let a = this.parent.depth >= other.parent.depth ? (this.parent as Case).parent : this.self;
         let b = other.parent.depth >= this.parent.depth ? (other.parent as Case).parent : other;
         return a.isAfter(b);
      }
   }
   // a base line, either an instruction, header or footer. 
   export interface BaseLine {
      // lines possibly have state. 
      readonly state?: State;
   }
   export type Line = Instruction | Header | Footer;



 


   // an instruction is a line that is explicitly added to a block. 
   export abstract class Instruction extends BaseLine implements BaseLine {
      get self(): this { return this; }
      // index in parent block, will never move.
      abstract get index(): number;
      // called to add or re-add an instruction. 
      addInstruction() {
         // block and all parents must be invalidated because adding an
         // instruction will change its size. 
         this.parent.invalidate();
         (this.index == this.parent.info.instructions.length).assert();
         this.parent.info.instructions.push(this);
         // register instruction's state for later lookup.
         this.parent.proc.states.add(this);
         let goto = this as any as Goto;
         // goto targets must also be registered. 
         if (goto.target) {
            let proc = this.parent.proc;
            let [idx, gotos] = proc.gotos.getOrSet(goto.target, () => {
               let idx = proc.labels.length;
               proc.labels.push(goto.target);
               return [idx, new Set<Goto>()];
            });
            gotos.add(goto);
         }
         if (this.addInner)
            // additional add logic based on instruction.
            this.addInner();
      }
      // called to remove instruction from code,
      // is undoable. 
      deleteInstruction(): rn.Undo {
         // must be last instruction.
         (this.parent.info.instructions.last() == this).assert();
         this.parent.info.instructions.pop();
         // invalidate block size since it has one less instruction
         this.parent.invalidate();
         // unregister state.
         this.parent.proc.states.delete(this);
         let zwitch = this as any as Switch;
         for (let b of zwitch.cases ? zwitch.cases : [])
            // unregister case block header states for switches.
            this.parent.proc.states.delete(b.header);
         let goto = this as any as Goto;
         // unregister goto target.
         if (goto.target) {
            let info = this.parent.proc;
            let [idx, gotos] = info.gotos.get(goto.target);
            gotos.delete(goto).assert();
            if (gotos.isEmpty()) {
               info.gotos.delete(goto.target);
               info.labels.splice(idx, 1);
               for (let i = idx; i < info.labels.length; i += 1) {
                  let [jdx, jumps] = info.gotos.get(info.labels[i]);
                  info.gotos.set(info.labels[i], [i, jumps]);
               }
            }
         }
         if (this.deleteInner)
            // custom by instruction.
            this.deleteInner();
         return () => {
            // undoing is just re-adding. 
            this.addInstruction();
            if (zwitch.cases)
               bl.initCases(zwitch);
         }
      }
   }
   export interface Instruction {
      readonly isPassThroughState?: true;
      isInvisible?: boolean;
      // if this instruction is a branch to another line. 
      // optional methods to extend what happens
      // when instruction is removed or added.
      addInner?(): void;
      deleteInner?(): void;
   }
   // base of header or footer, neither of which is
   // exposed outside of this namespace so does
   // not need to be exported. How they behave.
   abstract class HeaderFooter<T> extends BaseLine implements BaseLine {
      abstract get self(): Header | Footer;
      abstract get adbg(): string;
      abstract get parent(): Block;
      constructor(readonly owner: T) { super(); }
      abstract renderLine(rect: Rect2D, txt: Context): void;
   }
   export class Header extends HeaderFooter<Block> {
      get self(): this { return this; }
      get parent() { return this.owner; }
      get adbg(): string { return "header-" + this.parent.adbg; }
      // delegate header rendering to block's parameterized info.
      renderLine(rect: Rect2D, txt: Context): void { return this.parent.info.renderHeader(this, rect, txt); }
      // a header can only be edited off of if there
      // are instructions in the block it is heading.
      canEdit() { return this.parent.info.instructions.length == 0; }
      get previous(): Line {
         if (this.owner instanceof Proc)
            return null;
         // for a header of a case block, we are deleting the entire switch,
         // so should just be the predecessor for the switch.
         else return this.owner.parent.previous;
      }
      canDelete(): false | (() => rn.Undo) {
         // a header can be deleted if it is parented by 
         // a switch and the switch can be deleted
         // (deleting the header deletes the switch,
         // which allows us to undo creating a switch
         // quickly as selection will land on a header
         // after the switch is created).
         if (this.parent instanceof Case && this.parent.index == 0)
            return this.parent.parent.canDelete();
         else return false;
      }
      get parentBlock() {
         if (this.parent instanceof Case)
            return this.parent.parent.parent;
         else return super.parentBlock;
      }

   }
   export class Footer extends HeaderFooter<Proc | Switch> {
      get self(): this { return this; }
      get parent() { return this.owner instanceof Proc ? this.owner : this.owner.parent; }
      get adbg(): string { return "footer-" + this.owner; }
      renderLine(rect: Rect2D, txt: Context): void {
         // again, delegate to either proc or switch owner of footer
         // for rendering.
         if (this.owner instanceof Proc)
            return this.owner.info.renderFooter(this, rect, txt);
         else this.owner.renderFooter(rect, txt);
      }
      // a footer can only be edited off of if it is owned
      // by a switch and that switch is the last instruction
      // of its block.       
      canEdit() {
         if (this.owner instanceof Proc)
            return false;
         else if (this.owner.index != this.owner.parent.info.instructions.length - 1)
            return false;
         // a footer also cannot be edited if no control flow exists the switch,
         // which is determined later in instrucitons.ts. 
         else if (this.owner.footerCanEdit && !this.owner.footerCanEdit())
            return false;
         else return true;

      }
      get previous(): Line {
         //for a footer, the last instruction or the predecessor block header if none.
         let b = this.owner instanceof Proc ? this.owner : this.owner.cases.last();
         if (b.info.instructions.length == 0)
            return b.header;
         let prev = b.info.instructions.last() as Switch;
         return prev.cases ? prev.footer : prev;
      }
      canDelete(): false { return false; }
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






   export type Block = (Case | Proc);

   // render each line beyond the line's intrinsic rendering. 
   // manages selection input/highlighting, as well as 
   // rendering case blocks and rendering a footer if necessory
   // for a switch line.  
   function renderLine(line: Line, pos: Vector2D, txt: Context, lh: number, sp: number): number {
      if ((line as bl.Instruction).isInvisible) {
         (txt.host.selected == line).assert();
         return 0;
      }
      // we need a rectangle that extends to size of host
      let px = txt.peekTranslation().x;
      let rect = pos.addX(-txt.SW / 2).rect((txt.host.size.minus(txt.host.offset).x - px).vec(pos.y + lh + sp))
      // highlight lines that can be edited or deleted. 
      let canEdit = line.canEdit();
      let canDel = canEdit ? false : line.canDelete() != false;
      let cx = rect.max.x - txt.SW;
      let cy = pos.y + (lh + sp) / 2;
      if (canEdit || canDel) {
         txt.fillSmallCircle(cx.vec(cy), canEdit ? RGB.orangered : RGB.grey);
      } else if (line instanceof Header && line.parent instanceof Case && (!line.parent.info.isClosed || line.parent.info.isClosed() != false)) {
         txt.fillSmallCircle(cx.vec(cy), line.parent.compressed ? RGB.dodgerblue : RGB.white, {
            label: "collapse",
            acts: [
               ["click", () => () => {
                  line.parent.invalidate();
                  txt.host.selected = line;
                  this.compressed = !this.compressed;
                  let tup: [rn.Undo, rn.Address] = [() => {
                     line.parent.invalidate();
                     line.parent.compressed = !line.parent.compressed;
                  }, null];
                  return tup;
               }]
            ]
         }, true);
      }
      line.renderLine(pos.addY(sp).rect(rect.max), txt);
      txt.fillRect(rect, txt.host.selected == line ? RGB.dodgerblue.alpha(.1) : null, {
         addr: line.addr,
         label: "line",
         acts: [
            ["scrub", () => (m: Line) => {
               return () => txt.host.selected = m;
            }],
         ]
      });

      let dy = lh + sp;
      let zwitch = line as Switch;
      if (zwitch.cases) {
         for (let b of zwitch.cases) {
            txt.renderImage(b, pos.addY(dy));
            dy += b.size ? b.size.y : 0;
         }
         if (!zwitch.footer)
            (zwitch as any).footer = new Footer(zwitch);
         dy += renderLine(zwitch.footer, pos.addY(dy), txt, lh, sp);
      }
      return dy;
   }



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
      compressed = false;
      private depth0: number = undefined;
      get depth(): number {
         let d = this.depth0;
         if (d == undefined) {
            let parent = this.parentBlock;
            d = !parent ? 0 : parent.depth + 1;
            this.depth0 = d;
         }
         return d;
      }
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
      // render block core, just put out header, indent, then instructions.
      // and maybe a footer
      renderCore(txt: Context): Vector2D {
         let y = 0;
         let lh = this.proc.info.lineHeight(txt);
         lh = Math.ceil(lh * 1);
         let sp = Math.ceil(lh * .1);
         y += renderLine(this.header, (0).vec(y), txt, lh, sp);
         let yh = y;
         let x = txt.SW;
         if (!this.compressed) {
            if (this.info.instructions.every(ins => ins.isInvisible))
               y += (lh + sp) / 2;
            for (let line of this.info.instructions)
               y += renderLine(line, x.vec(y), txt, lh, sp);
            let selected = txt.host.selected ? txt.host.selected.parentBlock : null;
            txt.g.strokeLine([(x / 2).vec(yh), (x / 2).vec(y)], selected == this ? RGB.orangered : null);
            if (selected == this) {
               if (false) {
                  let w = txt.host.size.x - txt.peekTranslation().x;
                  txt.g.strokeLine([(0).vec(0), (w).vec(0)], .5);
                  txt.g.strokeLine([(0).vec(y), (w).vec(y)], .5);
               }
               txt.host.selectedY = txt.peekTranslation().y;
            }
         }
         if (this instanceof Proc)
            y += renderLine(this.footer, (0).vec(y), txt, lh, sp);
         return (100000).vec(y);
      }
      // returns the next line for a block that has ended.
      nextAsBlock(): Header | Footer {
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
   }

   // creates and returns a switch's case blocks (if creating).
   // register each case block header state for later lookup
   // (creating or re-adding).
   export function initCases(zwitch: Switch, infos?: BlockInfo[]) {
      let blocks = zwitch.cases;
      if (!blocks)
         blocks = infos.map((info, i) => new Case(zwitch, i, info));
      for (let b of blocks)
         zwitch.parent.proc.states.add(b.header);
      return blocks;
   }

   // client implemented info for block (instructions and how to render header). 
   export interface BlockInfo {
      readonly headerState?: State;
      readonly instructions: Instruction[];
      renderHeader(header: Header, rect: Rect2D, txt: Context): void;
      isClosed?(): false | "broken" | "notbroken";
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
      renderFooter(footer: Footer, rect: Rect2D, txt: Context): void;
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
      renderFooter(rect: Rect2D, txt: Context): void;
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
      abstract get proc(): Proc;
      private selected0: Line;
      get selected() { return this.selected0; }
      set selected(value: Line) { this.selected0 = value; }
      renderChild(pos: Vector2D, txt: rn.Context): Vector2D {
         if (!this.proc)
            return Vector2D.Zero;
         txt.renderImage(this.proc, pos, this.proc.header);
         return this.proc.size;
      }      

      // after an insertion of "next", advance selection until
      // editable line is found. 
      doSelectNextEdit(next: Line): rn.Undo {
         let orig = next;
         (next != null).assert();
         while (!next.canEdit()) {
            let n = next.next;
            if (!n)
               break;
            else next = n;
         }
         if (!next.canEdit())
            next = orig;
         return this.doSelect(next);
      }
      doSelect(line: Line) {
         let old = this.selected;
         this.selected = line;
         return () => {
            this.selected = old;
         }
      }

      // deletion as defined before, except adjust selection
      // when deletion happens and is undone. 
      canDelete(): false | (() => rn.Undo) {
         let f0 = this.selected ? this.selected.canDelete() : false;
         if (!f0)
            return false;
         let f = f0;
         return () => {
            let save = this.selected;
            // find previous line to be new selection.
            this.selected = this.selected.previous;
            let undo = f();
            return () => {
               undo();
               // restore original selection on undo.
               this.selected = save;
            }
         }


      }
      canEdit(): boolean {
         return this.selected ? this.selected.canEdit() : false;
      }
      selectedY: number;
      renderCore(txt: Context) {
         let ret = super.renderCore(txt);
         let block = this.selected ? this.selected.parentBlock : null;
         if (false && block) {
            let rectA = (0).vec(0).rect(this.size.x.vec(this.selectedY));
            let rectB = (0).vec(this.selectedY + block.size.y).rect(this.size);
            let shade = RGB.black.alpha(.025);
            txt.g.fillRect(rectA, null, shade);
            txt.g.fillRect(rectB, null, shade);




         }
         return ret;
      }
      protected cleanupPress() {
         super.cleanupPress();
         if ((this.selected as bl.Instruction).isInvisible) {
            (this.selected as bl.Instruction).isInvisible = false;
            this.selected.parent.invalidate();
         }
      }
   }
}






namespace bltest {
   type Block = bl.Block;
   interface Context extends bl.Context { }

   class Instruction extends bl.Instruction {
      get self(): this { return this; }
      get state(): null { return null; }
      renderLine(rect: Rect2D, txt: Context): void {
         txt.fillText(rect.min, this.text);
      }
      readonly index: number;
      constructor(readonly parent: Block, readonly text: string) {
         super();
         this.index = parent.info.instructions.length;
         this.addInstruction();
      }
      postAdd(): this { this.addInstruction(); return this; }
   }
   class Switch extends Instruction implements bl.Switch {
      readonly blockInfo: bl.BlockInfo[] = [];
      readonly cases: bl.Case[];
      constructor(parent: Block, text: string, readonly footerText: string, headers: string[]) {
         super(parent, text);
         this.cases = bl.initCases(this, headers.map(h => new BlockInfo(h)));
      }
      renderFooter(rect: Rect2D, txt: Context): void {
         txt.fillText(rect.min, this.footerText);
      }
      get isPassThroughState(): true { return true; }
   }
   class BlockInfo extends Object implements bl.BlockInfo {
      readonly instructions: bl.Instruction[] = [];
      constructor(readonly header: string) {
         super();
      }
      renderHeader(header: bl.Header, rect: Rect2D, txt: Context): void {
         txt.fillText(rect.min, this.header);
      }
   }
   class ProcInfo extends BlockInfo implements bl.ProcInfo {
      constructor() {
         super("proc");
      }
      lineHeight(txt: Context) { return txt.g.fontHeight(); }
      renderFooter(footer: bl.Footer, rect: Rect2D, txt: Context): void {
         txt.fillText(rect.min, "endproc");
      }
   }
   class Host extends bl.Host {
      constructor(readonly parent: ui2.Top, readonly proc: bl.Proc) {
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
                     let del = ins.canDelete();
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

