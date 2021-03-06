// the topology of a line/block document used to display/navigate instructions.
namespace bbl {
   export type Undo = () => void;
   // the base class of all lines, which are divided into footers, headers, and instructions. 
   export abstract class BaseLine extends Object {
      abstract get adbg(): string;
      // forward reference to final type. 
      abstract get self(): Line;
      // all lines except procedure header/footer have block parents. 
      abstract get parent(): Block;
      // immediate successor of this line.
      abstract get next(): Line;
      // immediate predecessor of this line.
      abstract get previous(): Line;
      // last sub-line of this line (the visual last line of its sub-block, if any, or self)
      abstract get lastSubLine(): Line;
      // can this line be edited via the menu? 
      abstract canEdit(): boolean;
      // is ok to be deleted?
      abstract canDelete(): false | [Line, () => Undo];
      abstract get tag() : "instruction" | "header" | "footer";
      abstract get proc() : Proc;
      // true if this line is after "other"
      isAfter(other: Line): boolean {
         if (this.parent == other.parent) {
            // blocks are same, false if this is a header or other is a footer.
            if (this.self instanceof Header || other instanceof Footer)
               return false;
            // true if opposite is true.
            else if (other instanceof Header || this.self instanceof Footer)
               return true;
            // otherwise compare indices. 
            return this.self.index > other.index;
         } else if (this.parent == null) 
            return this instanceof Footer;
         else if (other.parent == null)
            return other instanceof Header;
         // one block must have depth > 0, otherwise they would be the same. 
         (this.parent.depth > 0 || other.parent.depth > 0).assert();
         let ownerA = this.parent.owner as Case;
         let ownerB = other.parent.owner as Case;
         if (this.parent.depth == other.parent.depth && ownerA.owner == ownerB.owner)
            return ownerA.index > ownerB.index;
         let a = this.parent.depth >= other.parent.depth ? ownerA.owner : this.self;
         let b = other.parent.depth >= this.parent.depth ? ownerB.owner : other;
         return a.isAfter(b);
      }
      // any child lines.
      get subLines(): Line[] { return []; }
      equals(other: Line): boolean { return this.self == other; }
      isNestedIn(other: Line): boolean { return this.equals(other); }
      toString() { return this.adbg; }
   }
   // a line that is an instruction. 
   export abstract class Instruction extends BaseLine {
      get tag() : "instruction" { return "instruction"; }
      get self(): Instruction { return this; }
      get proc() : Proc { return this.parent.owner.proc; }
      // index in parent block.
      abstract get index(): number;
      // base next that ignores sublines (and subblocks). 
      baseNext(): Line {
         if (this.index < this.parent.instructions.length - 1)
            return this.parent.instructions[this.index + 1];
         else return this.parent.owner.nextFromLastInstruction;
      }
      get next(): Line {
         let lines = this.subLines;
         if (lines.length > 0)
            return lines[0];
         else return this.baseNext();
      }
      get previous(): Line {
         if (this.index > 0)
            return this.parent.instructions[this.index - 1].lastSubLine;
         else return this.parent.owner;
      }
      get lastSubLine(): Line {
         let lines = this.subLines;
         return lines.length == 0 ? this : lines.last().lastSubLine;
      }
      // called to add or re-add an instruction. 
      doAdd() {
         // block and all parents must be invalidated because adding an
         // instruction will change its size. 
         this.parent.invalidate();
         (this.index == this.parent.instructions.length).assert();
         this.parent.instructions.push(this);
         this.parent.owner.proc.register(this);
         if (this.isSwitch()) {
            for (let c of this.cases)
               this.parent.owner.proc.register(c);
            this.parent.owner.proc.register(this.footer);
         }
         if (this.addInner)
            // additional add logic based on instruction.
            this.addInner();
      }
      // called to remove instruction from code,
      // is undoable. 
      doDelete(): Undo {
         // must be last instruction.
         (this.parent.instructions.last() == this).assert();
         this.parent.instructions.pop();
         this.parent.owner.proc.unregister(this);
         if (this.isSwitch()) {
            for (let c of this.cases)
               this.parent.owner.proc.unregister(c);
            this.parent.owner.proc.unregister(this.footer);
         }
         // invalidate block size since it has one less instruction
         this.parent.invalidate();
         if (this.deleteInner)
            // custom by instruction.
            this.deleteInner();
         return () => this.doAdd();
      }
      canEdit() {
         if (this.index < this.parent.instructions.length - 1 || this.isSwitch() || this.status != "open")
            return false;
         else return true;
      }
      canDelete(): false | [Line, () => Undo] {
         if (this.index < this.parent.instructions.length - 1)
            return false;
         if (this.isSwitch() && this.cases.some(c => c.block.instructions.length > 0))
            return false;
         return [this.previous, () => this.doDelete()];
      }
      get status(): "open" | "broken" | "closed" { return "open"; }
      abstract isSwitch(): this is Switch;
      get subLines() { return this.isSwitch() ? (this.cases as Line[]).concat([this.footer]) : super.subLines; }
   }
   export interface Instruction {
      addInner?(): void;
      deleteInner?(): void;
   }
   // a branching instruction. 
   export interface Switch extends Instruction {
      readonly cases: Case[];
      readonly footer: Footer;
      isSwitch(): true;
   }
   // a line that is the header or footer of a block
   export abstract class HeaderFooter extends BaseLine { }
   // a block provider (factory) is used to create the block anchored in a header.
   export interface BlockProvider {
      makeBlock(header : Header) : Block;
   }
   export abstract class Header extends HeaderFooter {
      get tag() : "header" { return "header"; }
      // a header is either a procedure or a case. 
      abstract get self(): Proc | Case;
      // procedure above this header. 
      abstract get proc() : Proc;
      // block being headed by this header.
      readonly block: Block;
      constructor(provider : BlockProvider) {
         super();
         // block creation point. 
         this.block = provider.makeBlock(this);
      }
      // line that follows the block owned by this header. 
      abstract get nextFromLastInstruction(): Line;
      get next() {
         if (this.block.instructions.length > 0)
            return this.block.instructions[0];
         else return this.nextFromLastInstruction;
      }
      // can only edit from this line if the block is empty. 
      canEdit() { return this.block.instructions.length == 0; }
      // last sub-line of this block is either the last sub-line of its last instruction of its block (if any) or itself. 
      get lastSubLine() {
         return this.block.instructions.length > 0 ?
            this.block.instructions.last().lastSubLine : this;
      }
   }
   // a case of a switch instruction, which the header of a block that deals with the case. 
   export abstract class Case extends Header {
      get self(): Case { return this; }
      get proc() : Proc { return this.owner.proc; }
      // index in switch. 
      abstract get index(): number;
      abstract get owner(): Switch;
      get parent() { return this.owner.parent; }
      // next from last is either the next case or the footer of the switch. 
      get nextFromLastInstruction(): Line {
         if (this.index < this.owner.cases.length - 1)
            return this.owner.cases[this.index + 1];
         else return this.owner.footer;
      }
      canDelete() { return this.owner.canDelete(); }
      get adbg() { return this.owner.adbg + ":" + this.index; }
      // a case is empty if empty, closed if its last instruction (or last instructions of the last instruction's sub-blocks) 
      // is a goto or return statement, or otherwise
      get status(): "open" | "broken" | "closed" {
         if (this.block.instructions.length == 0)
            return "open";
         else return this.block.instructions.last().status;
      }
      get previous(): Line {
         if (this.index == 0)
            return this.owner;
         else return this.owner.cases[this.index - 1].lastSubLine;
      }
      constructor(owner : Switch) {
         super(owner.parent.owner.proc.provider);
      }
   }
   // footer of a block owned by either a switch or procedure. 
   // class-based variants for case and procedure aren't very useful,
   // so we just use instanceof as needed to vary behavior inside this class.
   export abstract class Footer extends HeaderFooter {
      get tag() : "footer" { return "footer"; }
      get self(): Footer { return this; }
      abstract get owner() : Proc | Switch;
      get proc() : Proc { return this.owner.proc; }
      get parent() { return this.owner.parent; }
      get adbg() { return this.owner.adbg + "-footer"; }
      // next instruction of footer is nothing if procedure, or
      // the base next of its owner. 
      get next() {
         if (this.owner instanceof Proc)
            return null;
         else return this.owner.baseNext();
      }
      get previous(): Line {
         if (this.owner instanceof Proc) {
            if (this.owner.block.instructions.length == 0)
               return this.owner;
            else return this.owner.block.instructions.last().lastSubLine;
         } else {
            if (this.owner.cases.length == 0)
               return this.owner;
            let last = this.owner.cases.last();
            if (last.block.instructions.length == 0)
               return last;
            else return last.block.instructions.last().lastSubLine;
         }
      }
      get lastSubLine(): Footer { return this; }
      // whether open, closed, or broken depeneds on a switches cases
      // (closed only if all closed, open if any is open, otherwise broken).
      get status(): "open" | "closed" | "broken" {
         if (this.owner instanceof Proc)
            return "closed";
         let ret: "broken" | "closed" = "closed";
         for (let c of this.owner.cases) {
            let status = c.status;
            if (status == "open")
               return "open";
            else if (status == "broken")
               ret = "broken";
         }
         return ret;
      }
      canEdit() {
         if (this.owner instanceof Proc)
            return false;
         let ins = this.owner;
         if (ins.index < ins.parent.instructions.length - 1)
            return false;
         return this.status == "broken";
      }
      canDelete() {
         if (this.owner instanceof Proc)
            return false;
         else return this.owner.canDelete();
      }
   }
   export type Line = Instruction | Header | Footer;
   // procedure header.
   export abstract class Proc extends Header {
      abstract get footer() : Footer;
      get proc(): Proc { return this; }
      constructor(readonly provider : BlockProvider) {
         super(provider);
      }
      get self(): Proc { return this; }
      get parent(): null { return null; }
      get nextFromLastInstruction() { return this.footer; }
      canDelete(): false { return false; }
      // empty, will fill in via an override. 
      register(line: Line): void { }
      unregister(line: Line): void { }
      invalidate(block: Block): void { }
      get subLines() : [Footer] { return [this.footer]; }
   }
   // a block of instructions. 
   export class Block extends Object {
      get adbg(): string { return this.owner.adbg + "-block"; }
      readonly instructions = new Array<Instruction>();
      // invalidate layout (if any)
      invalidate(): void {
         this.owner.proc.invalidate(this);
      }
      private depth0 : number = undefined;
      get depth(): number {
         if (this.depth0 == undefined) {
            if (this.owner instanceof Proc)
               this.depth0 = 0;
            else  this.depth0 = this.owner.owner.parent.depth + 1;
         }
         return this.depth0;
      }
      constructor(readonly owner: Case | Proc) {
         super();
      }
   }
}

