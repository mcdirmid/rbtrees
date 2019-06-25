
namespace vbl {
   export interface BaseLine extends bbl.BaseLine {
      readonly self: Line;
      readonly parent: Block;
      readonly subLines: Line[];
      readonly next: Line;
      readonly previous: Line;
      equals(other: Line): boolean;
      isNestedIn(other: Line): boolean;
   }
   export interface Instruction extends bbl.Instruction, BaseLine {
      readonly self: Instruction;
      readonly parent: Block;
      readonly subLines: Line[];
      readonly next: Line;
      readonly previous: Line;
      equals(other: Line): boolean;
      isNestedIn(other: Line): boolean;
      readonly tag : "instruction";
   }
   export interface Header extends bbl.Header, BaseLine {
      readonly self: Case | Proc;
      readonly block: Block;
      readonly parent: Block;
      readonly subLines: Line[];
      readonly next: Line;
      readonly previous: Line;
      equals(other: Line): boolean;
      isNestedIn(other: Line): boolean;
      readonly tag : "header";
   }
   export interface Proc extends bbl.Proc, Header {
      readonly self: Proc;
      readonly parent: null;
      canDelete(): false;
      readonly nextFromLastInstruction: Footer;
      readonly block: Block;
      readonly next: Line;
      readonly previous: null;
      equals(other: Line): boolean;
      isNestedIn(other: Line): boolean;
      readonly subLines: [Footer];
   }
   export interface Case extends bbl.Case, Header {
      readonly self: Case;
      readonly block: Block;
      readonly parent: Block;
      readonly subLines: Line[];
      readonly next: Line;
      readonly previous: Line;
      equals(other: Line): boolean;
      isNestedIn(other: Line): boolean;
   }
   export interface Footer extends bbl.Footer, BaseLine {
      readonly self: Footer;
      readonly lastSubLine: Footer;
      readonly parent: Block;
      readonly subLines: Line[];
      readonly next: Line;
      readonly previous: Line;
      equals(other: Line): boolean;
      isNestedIn(other: Line): boolean;
      readonly tag : "footer";
   }
   export interface Block extends bbl.Block {
      readonly instructions: Instruction[];
      readonly owner: Proc | Case;
   }
   export interface BlockProvider extends bbl.BlockProvider {
      makeBlock(header : Header) : Block;
   }

   export type Line = Instruction | Header | Footer;
}

namespace vbl {
   export interface BaseLine extends rn.Address {
      renderCoreLine(rect: Rect2D, txt: Context): void;
   }
   export abstract class Block extends bbl.Block {
      invalidate() {
         super.invalidate();
         if (this.size) {
            delete this.size;
            let parent = this.owner.parent;
            if (parent)
               parent.invalidate();
         }
      }
      renderCore(txt: Context): Vector2D {
         let h = renderBlock(this, txt);
         return (100000).vec(h);
      }
   }
   export interface Block extends rn.Image {
      compressed?: boolean;
   }

   export interface Instruction {
      readonly isInvisible?: boolean;
   }
   export abstract class Host extends rn.Host {
      selected: Line;
      abstract get proc(): Proc;
      lineHeight(txt: Context) { return txt.g.fontHeight(); }
      renderChild(pos: Vector2D, txt: Context): Vector2D {
         if (!this.proc)
            return Vector2D.Zero;
         let lh = this.lineHeight(txt);
         lh = Math.ceil(lh);
         let sp = Math.ceil(lh * .1);
         let y = renderLine(this.proc, pos, txt, lh, sp);
         return this.size.setY(y);
      }
      // deletion as defined before, except adjust selection
      // when deletion happens and is undone. 
      canDelete(): false | (() => rn.Undo) {
         let f0 = this.selected ? this.selected.canDelete() : false;
         if (!f0)
            return false;
         let [prev, f] = f0;
         return () => {
            let save = this.selected;
            // find previous line to be new selection.
            this.selected = prev as Line;
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
      doSelect(line: Line) {
         let old = this.selected;
         this.selected = line;
         return () => {
            this.selected = old;
         }
      }
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
   }
   export interface Context extends rn.Context {
      readonly host: Host;
      renderImage(b: Block, pos: Vector2D): void;
   }



   function renderLine(line: Line, pos: Vector2D, txt: Context, lh: number, sp: number): number {
      let y = pos.y;
      if ((line as Instruction).isInvisible) {
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
      } else if (line.tag == "header" && line.block.instructions.length > 0 &&
         line.block.instructions.last().status != "open") {
         let block = line.block;
         txt.fillSmallCircle(cx.vec(cy), block.compressed ? RGB.dodgerblue : RGB.white, {
            label: "collapse",
            acts: [
               ["click", () => () => {
                  line.block.invalidate();
                  txt.host.selected = line;
                  this.compressed = !this.compressed;
                  let tup: [rn.Undo, rn.Address] = [() => {
                     block.invalidate();
                     block.compressed = !block.compressed;
                  }, null];
                  return tup;
               }]
            ]
         }, true);
      }
      line.renderCoreLine(pos.addY(sp).rect(rect.max), txt);
      txt.fillRect(rect, txt.host.selected == line ? RGB.dodgerblue.alpha(.1) : null, {
         addr: line,
         label: "line",
         acts: [
            ["scrub", () => (m: Line) => {
               return () => txt.host.selected = m;
            }],
         ]
      });
      y += (rect.max.y - rect.min.y);


      if (line.tag == "header") {
         txt.renderImage(line.block, pos.setY(y));
         if (line.block.size)
            y += line.block.size.y;
      }
      for (let ln of line.subLines)
         y += renderLine(ln, pos.setY(y), txt, lh, sp);
      return y - pos.y;
   }

   function renderBlock(block: Block, txt: Context): number {
      if (block.compressed)
         return 0;
      let y = 0;
      let lh = txt.host.lineHeight(txt);
      lh = Math.ceil(lh);
      let sp = Math.ceil(lh * .1);
      let x = txt.SW;
      if (block.instructions.every(line => line.isInvisible))
         y += (lh + sp) / 2;
      for (let line of block.instructions)
         y += renderLine(line, x.vec(y), txt, lh, sp);
      let selected = txt.host.selected ? txt.host.selected.parent : null;
      txt.g.strokeLine([(x / 2).vec(0), (x / 2).vec(y)], selected == block ? RGB.orangered : null);
      return y;
   }

   function renderProc(proc: Proc, txt: Context) {
      let lh = txt.host.lineHeight(txt);
      lh = Math.ceil(lh);
      let sp = Math.ceil(lh * .1);
      return renderLine(proc, (0).vec(0), txt, lh, sp);
   }


}