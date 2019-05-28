namespace ui2 {

   export abstract class BaseWrapper<ElemT extends Elem> extends Elem {
      child: ElemT;
      setChild<ElemTT extends ElemT>(child: ElemTT): ElemTT {
         return setChild(this, child) as ElemTT;
      }
      get children() { return this.child ? [this.child] : super.children; }
      protected sizeChild(g: Render2D, child: Elem) {
         child.position = Vector2D.Zero;
         child.size = this.size;
      }
      protected renderLocal(g: Render2D) {
         super.renderLocal(g);
         if (this.child)
            this.sizeChild(g, this.child);
      }
   }

   export class Wrapper<ElemT extends Elem> extends BaseWrapper<ElemT> {
      private readonly parent00: Elem;
      get parent() { return this.parent00; }
      constructor(parent: Elem) {
         super();
         this.parent00 = parent;
      }
   }
   export abstract class HasParent0<ParentT extends Elem> extends Elem {
      private readonly parent00: ParentT;
      get parent() { return this.parent00; }
      constructor(parent: ParentT) {
         super();
         this.parent00 = parent;
      }
   }

   export abstract class HasParent extends Elem {
      private readonly parent00: Elem;
      get parent() { return this.parent00; }
      constructor(parent: Elem) {
         super();
         this.parent00 = parent;
      }
   }


   export class Top extends BaseWrapper<Elem> {
      public readonly g: Render2D;

      dragDist = 10;
      static get current() { return Top.current0; }
      private static current0: Top;
      protected asTop() { return this; }
      renderer() { return this.g; }
      get parent(): Elem { return null; }
      get isMouseDown() { return this.handle != null; }
      private handle: DragT;
      private clickId = 0;
      constructor(sz: Vector2D) {
         super();
         let canv = document.createElement("canvas");
         this.g = new Render2D(canv);
         this.g.setSize(sz);
         this.g.txt.textAlign = "start";
         this.g.txt.textBaseline = "top";
         {
            let start = Vector2D.Zero;
            let last = start;
            let isDragging = false;
            let isHold = false;
            let self = this;
            this.g.onmousedown = v => {
               start = v;
               last = v;
               self.overlay = null;
               let d = self.pressStartSelected(self.g, start);
               self.handle = d ? d : self.pressStart(self.g, start);
               if (self.handle && self.handle(v, isDragging, false, isHold)) { }
               self.renderAll();
               let clickId = self.clickId;
               self.clickId += 1;
               let current = self.handle;
               if (self.handle)
                  setTimeout(() => {
                     if (!isHold && !isDragging && current == self.handle) {
                        isHold = true;
                        if (self.handle(last, isDragging, false, isHold))
                           self.renderAll();
                     }
                  }, 500);
            };
            this.g.onmousemove = v => {
               if (!self.handle)
                  return;
               last = v;
               if (v.dist(start) > this.dragDist)
                  isDragging = true;
               if (self.handle(v, isDragging, false, isHold))
                  self.renderAll();
            };
            this.g.onmouseup = v => {
               if (!self.handle)
                  return;
               last = v;
               if (self.handle(v, isDragging, true, isHold)) { }
               self.overlay = null;
               self.handle = null;
               self.renderAll();
               isDragging = false;
               isHold = false;
            };
            this.g.canvas.ontouchmove = v => {
               v.preventDefault();
            };
            this.g.canvas.ontouchstart = v => {
               v.preventDefault();
            };
            this.g.canvas.ontouchend = v => {
               v.preventDefault();
            };

         }
         document.body.appendChild(canv);
      }
      overlay: (top: Top, g: Render2D) => void;
      beforeRender: () => void = null;
      renderAll() {
         (Top.current0 == null).assert();
         Top.current0 = this;
         if (this.beforeRender)
            this.beforeRender();
         this.position = Vector2D.Zero;
         this.size = this.g.size;
         this.g.strokeStyle = RGB.black;
         this.g.txt.clearRect(0, 0, this.size.x, this.size.y);
         this.g.txt.strokeRect(0, 0, this.size.x, this.size.y);
         this.render(this.g);
         if (this.overlay)
            this.overlay(this, this.g);
         (Top.current0 == this).assert();
         Top.current0 = null;
      }
      renderLocal(g: Render2D) {
         super.renderLocal(g);
         g.strokeStyle = RGB.black;
         g.fillStyle = RGB.black;
      }
      static useWindow(): Top {
         let sz = window.innerSize();
         let top = new Top(sz);
         window.onresize = (ev) => {
            top.g.setSize(window.innerSize());
            top.g.txt.textAlign = "start";
            top.g.txt.textBaseline = "top";
            top.renderAll();
         };
         window.onscroll = (ev) => {
            window.scrollTo(0, 0);
         };
         window.onkeydown = (key) => {
            let start: Elem = top;
            while (start) {
               if (key.key == "Shift") {
                  if (start.doShift(key, start.top().g, true)) {
                     key.preventDefault();
                     top.renderAll();
                     return;
                  }
               } else if (key.key == "Control") {
                  if (start.doCtrl(key, start.top().g, true)) {
                     key.preventDefault();
                     top.renderAll();
                     return;
                  }
               } else if (start.doKey(key, start.top().g)) {
                  key.preventDefault();
                  top.renderAll();
                  return;
               }
               start = start.childSelected;
            }
            return;
         };
         window.onkeyup = (key) => {
            if (key.key != "Control" && key.key != "Shift")
               return;
            let start: Elem = top;
            while (start) {
               if (key.key == "Control" && start.doCtrl(key, start.top().g, false)) {
                  key.preventDefault();
                  top.renderAll();
                  return;
               }
               if (key.key == "Shift" && start.doShift(key, start.top().g, false)) {
                  key.preventDefault();
                  top.renderAll();
                  return;
               }
               start = start.childSelected;
            }
            return;
         }

         window.onwheel = (ev) => {
            ev.preventDefault();
            let start: Elem = top;
            while (start) {
               if (start.doScroll(ev.deltaY)) {
                  top.renderAll();
                  return;
               }
               start = start.childSelected;
            }
            return;
         };
         return top;
      }
   }



   export enum DivKind {
      Absolute = 0,
      Percent = 1,
      Fixed = 2,
   }
   export enum Orientation {
      Vertical = 0, Horizontal = 1,
   }
   export interface IDivElem extends Elem {
      layout: [DivKind, number];
   }
   export function DivElem<T extends Elem>(elem: T, lt: [DivKind, number]): T & IDivElem {
      let ret = elem as T & IDivElem;
      ret.layout = lt;
      return ret;

   }


   export class Divider extends HasParent {
      // provides two panes
      orientation = Orientation.Horizontal;
      private readonly children0 = new Array<IDivElem>();
      get children() { return this.children0; }
      seam = 2;
      private doLayout(g: Render2D) {
         let sz = this.size;
         let flip = (this.orientation != Orientation.Horizontal);
         let total = 0;
         let noLayout = 0;
         for (let c of this.children) {
            if (!c.layout) {
               noLayout += 1;
               continue;
            }
            else if (c.layout[0] == DivKind.Absolute)
               c.size = c.layout[1].vec(sz.xy(flip), flip);
            else if (c.layout[0] == DivKind.Percent)
               c.size = (c.layout[1] * sz.xy(!flip)).vec(sz.xy(flip), flip);
            else if (c.layout[0] == DivKind.Fixed)
               c.size = c.fixed(g).xy(!flip).vec(sz.xy(flip), flip);
            total += c.size.xy(!flip);
         }
         //
         let at = 0;
         for (let c of this.children) {
            if (!c.layout)
               c.size = ((sz.xy(!flip) - total) / noLayout).vec(sz.xy(flip), flip);
            c.position = at.vec(0, flip);
            at += c.size.xy(!flip);
         }
      }
      protected renderLocal(g: Render2D) {
         this.doLayout(g);
         super.renderLocal(g);
      }
   }

   export class CachedFixed extends HasParent {
      private fixed0: Vector2D;
      private isFixedValid: boolean = false;
      protected computeFixed(g: Render2D) { return super.fixed(g); }
      constructor(parent: Elem) {
         super(parent);
      }
      fixed(g: Render2D) {
         if (!this.isFixedValid)
            this.fixed0 = this.computeFixed(g);
         this.isFixedValid = true;
         return this.fixed0;
      }
      invalidate() {
         super.invalidate();
         this.isFixedValid = false;
      }
   }
   export class Flow extends CachedFixed {
      orientation: Orientation = Orientation.Vertical;
      gap: number = 5;
      private readonly children0 = new Array<Elem>();
      get children() { return this.children0; }
      protected computeFixed(g: Render2D) {
         // layout.
         let xy = 0;
         let maxYX = 0;
         let isX = this.orientation == Orientation.Horizontal;
         for (let c of this.children) {
            // c.position = xy.vec(0, isX);
            let fixed = c.fixed(g);
            let d = fixed.xy(isX);
            (d > 0).assert();
            xy += d;
            let h = fixed.xy(!isX);
            if (h < 0)
               maxYX = -1;
            else if (maxYX >= 0)
               maxYX = maxYX.max(h);
         }
         xy += (this.gap * this.children.length);
         return xy.vec(maxYX, !isX);
      }
      protected renderLocal(g: Render2D) {
         let xy = 0;
         let isX = this.orientation == Orientation.Horizontal;
         for (let c of this.children) {
            xy += this.gap;
            c.position = xy.vec(this.gap, !isX);
            let fixed = c.fixed(g);
            let d = fixed.xy(isX);
            (d > 0).assert();
            xy += d;
            c.size = d.vec(this.size.xy(!isX) - this.gap, !isX);
         }
      }
   }
   export class Wrapped extends CachedFixed {
      orientation: Orientation = Orientation.Vertical;
      gap: number = 5;
      private readonly children0 = new Array<Elem>();
      get children() { return this.children0; }
      protected computeFixed(g: Render2D) {
         let y = this.gap;
         let x = this.gap;
         let my = 0;
         (this.parent instanceof Scroller).assert();
         let w = this.parent.size.x;
         for (let c of this.children) {
            let sz = c.fixed(g);
            if (x + sz.x > w && x > this.gap) {
               x = this.gap;
               y += my + this.gap;
               my = 0;
            }
            c.position = x.vec(y);
            x += sz.x + this.gap;
            my = my.max(sz.y);
            c.size = sz;
         }
         y += my;
         return this.parent.size.x.vec(y);
      }
   }
   export class Tester extends HasParent {
      fixed(g: Render2D): Vector2D {
         g.font = Elem.font;
         return (-1).vec(g.fontHeight() * 1000);
      }
      protected renderLocal(g: Render2D) {
         g.font = Elem.font;
         let fh = g.fontHeight();
         g.fillStyle = RGB.black;
         //g.fillRect((100).vec(100).rect((175).vec(200)), [50, 0, 0, 50]);
         for (let i = 0; i < 1000; i += 1)
            g.fillText(i.toString(), (10).vec(i * fh));
      }
   }
   interface IScrolled extends Elem {
      scrollY: number;
      height0: number;
   }
   export class Scroller extends HasParent {
      private child: IScrolled;
      get children() { return this.child ? [this.child as Elem] : []; }
      protected renderLocal(g: Render2D) {
         super.renderLocal(g);
         if (!this.child)
            return;
         let th = this.child.fixed(g).y;
         (th > 0).assert();
         this.child.height0 = th;
         let h = this.size.y;
         // offset is between 0 and th - h.
         if (!this.child.scrollY)
            this.child.scrollY = 0;
         if (h >= th)
            this.child.scrollY = 0;
         else this.child.scrollY = this.child.scrollY.clamp(0, th - h);
         this.child.position = (0).vec(-this.child.scrollY);
         this.child.size = this.size.x.vec(th.max(h));
      }
      protected renderLast(g: Render2D) {
         super.renderLast(g);
         if (!this.child)
            return;
         if (this.child.scrollY > 0 || this.child.scrollY + this.size.y < this.child.height0) {
            g.txt.shadowColor = RGB.black.toString();
            g.txt.shadowOffsetY = 0;
            g.txt.shadowBlur = 10;
            g.fillStyle = this.child.background || this.background || RGB.black;
            if (this.child.scrollY > 0)
               g.fillRect(Vector2D.Zero.rect(this.size.x.vec(1)));
            if (this.child.scrollY + this.size.y < this.child.height0)
               g.fillRect((0).vec(this.size.y - 1).rect(this.size));
            g.txt.shadowOffsetY = 0;
            g.txt.shadowBlur = 0;
            g.txt.shadowColor = null;
         }
         {
            let th = this.child.height0;
            let h = this.size.y;
            let start = this.child.scrollY / th;
            let end = (this.child.scrollY + h) / th;
            if (end < 1 || start > 0) {
               // render a line.
               g.fillStyle = (this.isSelected ? RGB.red : RGB.black).alpha(.5);
               g.strokeStyle = RGB.black;
               let rad = 3;
               let sy = start * h;
               let ey = end * h;
               let sx = this.size.x - rad;
               let ex = this.size.x;
               g.fillRect(sx.vec(sy).rect(ex.vec(ey)), [rad, 0, 0, rad]);
            }
         }
      }
      setChild<T extends Elem>(child: T) {
         if (child == this.child as any as T)
            return child;
         (!child || child.parent == this).assert();
         if (this.child) {
            let oldChild = this.child;
            this.child = null;
            this.removedChild(oldChild);
         }
         this.child = child as IScrolled & T;
         return child;
      }
      doScroll(deltaY: number) {
         if (!this.child)
            return super.doScroll(deltaY);
         if (!this.child.scrollY)
            this.child.scrollY = 0;
         this.child.scrollY += deltaY;
         this.invalidate();
         return true;
      }
      ensureVisible(offsetY: number) {
         if (!this.child)
            return;
         let start = this.child.scrollY;
         let end = start + this.child.height0;
         if (offsetY < start)
            this.doScroll(offsetY - start);
         else if (offsetY > end)
            this.doScroll(offsetY - end);
      }
      protected pressStartLocal(g: Render2D, orig: Vector2D) {
         if (!this.child)
            return super.pressStartLocal(g, orig);
         let scrollY = this.child.scrollY;
         return (v: Vector2D, isDrag: boolean, isEnd: boolean) => {
            let dY = v.y - orig.y;
            this.child.scrollY = scrollY - dY;
            this.invalidate();
            return true;
         };
      }
   }
   export class Tabber extends HasParent {
      private readonly children0 = new Array<Elem>();
      private visibleIndex = 0;
      get children() { return this.children0; }
      protected isChildVisible(child: Elem) {
         if (child == this.children[this.visibleIndex])
            return super.isChildVisible(child);
         else return false;
      }
      private visibleX: { start: number, end: number };
      protected renderLocal(g: Render2D) {
         super.renderLocal(g);
         g.font = Tabber.font;
         let fh = g.fontHeight() + 10;
         if (this.children.length == 0) {
            this.visibleIndex = 0;
            this.visibleX = null;
            return;
         }
         this.visibleIndex = this.visibleIndex.clamp(0, this.children.length - 1);
         let childPos = (0).vec(fh);
         let childSize = this.size.minus(childPos);
         let x = 0;
         let fontColor = this.background ? this.background.lerp(RGB.black, .5) : RGB.black;
         g.fillStyle = fontColor;
         g.strokeStyle = fontColor;
         let mask = RGB.black.alpha(.125);


         let idx = 0;
         for (let c of this.children) {
            c.position = childPos;
            c.size = childSize;
            // render.
            let name = c.elemName ? c.elemName() : "child" + idx;
            g.fillText(name, (x + 5).vec(5));
            let tw = g.textWidth(name) + 10;
            g.strokeRect(x.vec(0).rect((x + tw).vec(fh)));
            if (idx != this.visibleIndex) {
               g.fillStyle = mask;
               g.fillRect(x.vec(0).rect((x + tw).vec(fh)));
               g.fillStyle = fontColor;
            }
            else {
               this.visibleX = { start: x, end: x + tw };
               if (this.isSelected) {
                  g.fillStyle = RGB.red.alpha(.5);
                  g.fillCircle(x.vec(0).add((5).vec(5)), 2.5);
                  g.fillStyle = fontColor;
               }
            }
            x += tw;
            idx += 1;

         }
      }
      protected pressStartLocal(g: Render2D, v: Vector2D) {
         g.font = Tabber.font;
         let fh = g.fontHeight() + 10;
         if (v.y > fh || !this.visibleX || v.x < this.visibleX.start || v.x > this.visibleX.end)
            return super.pressStartLocal(g, v);
         return (w: Vector2D, isDrag: boolean, isEnd: boolean) => {
            let at = this.children[this.visibleIndex];
            if (w.x < this.visibleX.start && this.visibleIndex > 0) {
               // move...
               let other = this.children[this.visibleIndex - 1];
               this.children[this.visibleIndex - 1] = at;
               this.children[this.visibleIndex] = other;
               this.visibleIndex -= 1;
               this.invalidate();
               return true;
            }
            else if (w.x > this.visibleX.end && this.visibleIndex < this.children.length - 1) {
               let other = this.children[this.visibleIndex + 1];
               this.children[this.visibleIndex + 1] = at;
               this.children[this.visibleIndex] = other;
               this.visibleIndex += 1;
               this.invalidate();
               return true;
            }
            return false;
         }
      }
   }

   export class Cached extends CachedFixed {
      private backBuffer: Render2D;
      private isValid: boolean = false;
      invalidate() { this.isValid = false; super.invalidate(); }
      constructor(parent: Elem) {
         super(parent);
      }
      renderer() {
         if (this.backBuffer)
            return this.backBuffer;
         else return super.renderer();
      }

      protected transfer(from: Render2D, to: Render2D) {
         to.txt.textAlign = from.txt.textAlign;
         to.txt.textBaseline = from.txt.textBaseline;
      }
      protected renderInner(g: Render2D) {
         if (!this.isValid || !this.backBuffer) {
            if (this.backBuffer && this.backBuffer.size.equals(this.size))
               this.backBuffer.txt.clearRect(0, 0, this.size.x, this.size.y);
            else {
               this.backBuffer = g.mkImage(this.size);
            }
            this.transfer(g, this.backBuffer);
            super.renderInner(this.backBuffer);
            this.isValid = true;
         }
         g.drawImage(this.backBuffer);
      }
   }
   export class Collapsable extends Wrapper<Elem> {
      isOpen: boolean = true;
      protected isChildVisible(child: Elem) {
         if (!this.isOpen)
            return false;
         return super.isChildVisible(child);
      }
      protected sizeChild(g: Render2D, child: Elem) {
         if (!this.isOpen)
            return;
         g.font = Collapsable.font;
         let fh = g.fontHeight();
         child.position = Vector2D.Zero.setY(fh);
         child.size = this.size.minus((0).vec(fh));
      }
      fixed(g: Render2D) {
         g.font = Collapsable.font;
         let fh = g.fontHeight();
         if (!this.child)
            return Vector2D.Zero;
         let width = g.textWidth(this.child.elemName()) + fh;
         if (!this.isOpen)
            return (-1).vec(fh);
         let csz = this.child.fixed(g);
         (csz.y > 0).assert();
         return (true ? -1 : csz.x == -1 ? -1 : csz.x.max(width)).vec(fh + csz.y);
      }
      private static closedTriangle(g: Render2D, fh: number) {
         let d = fh / 4;

         let p0 = (d).vec(d);
         let p1 = (p0.x).vec(fh - d);
         let p2 = (fh / 2).vec(fh / 2);
         g.txt.beginPath();
         g.txt.moveTo(p0.x, p0.y);
         g.txt.lineTo(p1.x, p1.y);
         g.txt.lineTo(p2.x, p2.y);
         g.txt.lineTo(p0.x, p0.y);
         g.txt.closePath();
      }
      private static openTriangle(g: Render2D, fh: number) {
         let d = fh / 4;
         let l = fh / (2 * Math.sqrt(2));
         let p0 = (d).vec(fh - (fh - l) / 2);
         let p1 = (p0.x + l).vec(p0.y);
         let p2 = (p1.x).vec(p1.y - l);

         g.txt.beginPath();
         g.txt.moveTo(p0.x, p0.y);
         g.txt.lineTo(p1.x, p1.y);
         g.txt.lineTo(p2.x, p2.y);
         g.txt.lineTo(p0.x, p0.y);
         g.txt.closePath();
      }
      renderLocal(g: Render2D) {
         super.renderLocal(g);
         let fontColor = this.background ? this.background.lerp(RGB.black, .75) : RGB.black;
         g.fillStyle = fontColor;
         g.strokeStyle = fontColor;
         g.font = Collapsable.font;
         let fh = g.fontHeight();
         if (!this.isOpen) {
            Collapsable.closedTriangle(g, fh);
            g.txt.stroke();
         } else {
            Collapsable.openTriangle(g, fh);
            g.txt.fill();
         }
         if (this.child)
            g.fillText(this.child.elemName(), fh.vec(0));
      }
      protected pressStartLocal(g: Render2D, v: Vector2D) {
         return this.simplePress(() => {
            g.font = Collapsable.font;
            if (v.y <= g.fontHeight()) {
               this.isOpen = !this.isOpen;
               this.invalidate();
            }
         });
      }
   }
   export abstract class BaseLabel extends ui2.Elem {
      abstract get label(): string;
      abstract get pad(): number | number[];
      fixed(g: Render2D) {
         let w = g.textWidth(this.label);
         let h = g.fontHeight();
         w += this.extraX(g);
         if (typeof this.pad == "number")
            return (w + this.pad * 2).vec(h + this.pad * 2);
         else
            return (w + (this.pad[0] + this.pad[3]) / 2 + (this.pad[1] + this.pad[2]) / 2).
               vec(h + (this.pad[0] + this.pad[1]) / 2 + (this.pad[2] + this.pad[3]) / 2);
      }
      extraX(g: Render2D) { return 0; }
      rounding(): number | number[] { return this.pad; }
      get tag(): any { return null; }
      get act(): (lbl: this) => void { return null; }
      renderLocal(g: Render2D) {
         g.fillStyle = this.pressing ? RGB.red : this.tag && this.isSelected ? RGB.red : this.act ? this.foreground : RGB.dimgrey;
         g.fillText(this.label, ((this.size.x - this.extraX(g) - g.textWidth(this.label)) / 2).vec((this.size.y - g.fontHeight()) / 2));
      }
      protected pressStartLocal(g: Render2D, v: Vector2D) {
         if (!this.act)
            return super.pressStartLocal(g, v);
         let act = this.act;
         return this.simplePress(() => {
            act(this);
         })
      }
   }

   export class Label extends BaseLabel {
      get label(): string { return this.label00 ? this.label00() : null; }
      private act0: (lbl: this) => void;
      get act() { return this.act0; }
      pad0: number | number[];
      get pad() { return this.pad0; }
      set pad(value: number | number[]) { this.pad0 = value; }
      label00: () => string;
      get tag(): any { return this.tag00; }
      constructor(readonly parent: Elem, label?: string | (() => string), act?: (lbl: Label) => void, public tag00: any = null) {
         super();
         if (typeof label == "string")
            this.label00 = () => label;
         else if (label)
            this.label00 = label;
         this.label;
         this.act0 = act;
         this.border = { thickness: .5 };
         if (!this.foreground)
            this.foreground = RGB.black;
         if (!this.pad && this.pad != 0)
            this.pad = 4;
      }
      static makeLabel(parent: Elem, name?: string | (() => string)) {
         let ret = new Label(parent, name);
         ret.border = null;
         ret.pad = 0;
         ret.background = null;
         return ret;
      }
   }
   export interface IDropDownChoice {
      readonly name: string;
      selected(): void;
   }
   export class DropDown extends Label {
      pad: number = 4;
      constructor(parent: ui2.Elem, label: string, public choices: Iterable<IDropDownChoice>) {
         super(parent, label);
      }
      get label() { return super.label + "▾"; }
      protected pressStartLocal(g: Render2D, v: Vector2D): ui2.DragT {
         let top = this.top();
         let dw = this.positionTo(top);
         let choices = this.choices.toArray();
         let mx = choices.reduce((a, b) => a.max(g.textWidth(b.name)), 0) + this.pad;
         let x = dw.x;
         let y = dw.y + this.size.y + this.pad;
         let self = this;
         let selectedIndex = -1;
         let maxY = y;
         for (let c of self.choices) {
            maxY += g.fontHeight() + self.pad;
         }

         return (v, isDrag, isEnd) => {
            if (isEnd) {
               if (selectedIndex >= 0) {
                  let choice = self.choices.toArray()[selectedIndex];
                  if (choice)
                     choice.selected();
               }
            }
            if (isDrag && !top.overlay)
               top.overlay = (top, g) => {
                  let y0 = maxY;
                  g.fillStyle = RGB.white;
                  g.fillRect(x.vec(y).rect((x + mx + this.size.x).vec(y0)));
                  g.fillStyle = RGB.black;
                  g.strokeStyle = RGB.black;
                  y0 = y;
                  let idx = 0;
                  for (let c of self.choices) {
                     g.fillStyle = idx == selectedIndex ? RGB.red : RGB.black;
                     g.fillText(c.name, (x + this.size.x).vec(y0));
                     y0 += g.fontHeight() + self.pad;
                     idx += 1;
                  }
                  g.lineWidth = .5;
                  g.strokeRect(x.vec(y).rect((x + mx + this.size.x).vec(y0)));
               };

            v = v.add(dw);
            let idx: number;
            if (v.x >= x && v.x < x + mx + this.size.x &&
               v.y >= y && v.y <= maxY)
               idx = Math.floor((v.y - y) / (g.fontHeight() + this.pad));
            else idx = -1;
            if (idx != selectedIndex) {
               selectedIndex = idx;
               return true;
            }
            return false;
         }
      }
   }

   export class Field extends Label {
      private label11: string;
      get label00() { return () => this.label11; }
      constructor(parent: ui2.Elem, label: string, act?: (nm: string) => void) {
         super(parent, null);
         this.label11 = label;
         if (act)
            this.changed = act;
      }
      index = 0;
      get label() { return this.label11; }
      protected renderBorder(g: Render2D) {
         g.strokeStyle = this.isSelected ? RGB.red : this.foreground;
         g.lineWidth = this.border.thickness;
         let rect = this.size.asRect();
         g.strokeRect(rect);
         if (this.isSelected && this.index >= 0 && this.index <= this.label00.length) {
            g.lineWidth = 2;
            let x = g.textWidth(this.label.slice(0, this.index)) + 2;
            g.strokeLine([x.vec(0), x.vec(this.size.y)]);
         }
      }
      changed: (nm: string) => void = () => { };
      doKey(key: KeyboardEvent, g: Render2D) {
         this.index = this.index.clamp(0, this.label00.length);
         switch (key.code) {
            case "ArrowRight":
               this.index = (this.index + 1).min(this.label00.length);
               return true;
            case "ArrowLeft":
               this.index = (this.index - 1).max(0);
               return true;
            case "Backspace":
               if (this.index > 0) {
                  this.index -= 1;
                  this.label11 = this.label11.slice(0, this.index) + this.label11.slice(this.index + 1);
                  this.changed(this.label11);
                  this.invalidate();
                  return true;
               }
         }
         if (key.key && key.key.length == 1) {
            this.label11 = this.label11.slice(0, this.index) + key.key + this.label11.slice(this.index);
            this.index += 1;
            this.changed(this.label11);
            this.invalidate();
            return true;
         }
         return super.doKey(key, g)
      }
      protected pressStartLocal(g: Render2D, v: Vector2D): ui2.DragT {
         return null;
      }
   }

}