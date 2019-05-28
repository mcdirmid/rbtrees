namespace ui2 {
   export type DragT = (v: Vector2D, isDrag: boolean, isEnd: boolean, isHold: boolean) => boolean;
   export interface Border {
      thickness: number,
      noRight?: boolean,
      noBottom?: boolean,
   }
   export abstract class Elem extends Object implements IBrandable {
      background: RGB;
      foreground: RGB;
      get actualBackground() {
         let at = this as Elem;
         while (at && !at.background)
            at = at.parent;
         return at ? at.background : null;
      }
      renderer(): Render2D { return this.parent.renderer(); }
      border: Border;
      abstract get parent(): Elem;
      private domDepth00 = -1;
      resetDomDepth() { 
         if (this.domDepth00 != -1) {
            this.domDepth00 = -1;
            for (let c of this.children)
               c.resetDomDepth();
         } 
      }
      public domDepth(): number {
         if (this.domDepth00 < 0) {
            let p = this.parent;
            if (p)
               this.domDepth00 = p.domDepth() + 1;
            else this.domDepth00 = 0;
         }
         return this.domDepth00;
      }
      constructor() { super(); }
      elemName(): string { return null; }
      protected asTop() { return null as Top; }
      top(): Top {
         let at = this as Elem;
         while (at.parent)
            at = at.parent;
         (at.asTop() != null).assert();
         return at.asTop();
      }
      get children(): Iterable<Elem> { return new Array<Elem>(0); }
      private childSelected00: Elem;
      get childSelected(): Elem { return this.childSelected00; }
      get alwaysSelected() { return !this.parent; }
      get isSelected(): boolean {
         let ret = this.alwaysSelected || (this.parent.childSelected == this && this.parent.isSelected);
         if (ret && this.parent)
            this.parent.isSelected.assert();
         return ret;
      }
      get isLastSelected() {
         return this.isSelected && !this.childSelected;
      }
      get lastSelected() {
         if (!this.isSelected)
            return null;
         let at: Elem = this;
         while (true) {
            if (at.childSelected)
               at = at.childSelected;
            else return at;
         }
      }


      protected isVisible(): boolean {
         if (!this.parent)
            return true;
         else return this.parent.isChildVisible(this);
      }
      protected isChildVisible(elem: Elem) {
         return true;
      }
      isChildOf(elem: Elem): boolean {
         if (this.domDepth() <= elem.domDepth())
            return false;
         let at = this as Elem;
         while (at.domDepth() > elem.domDepth())
            at = at.parent;
         return at == elem;
      }
      private position0: Vector2D = Vector2D.Zero;
      get position() { return this.position0; }
      set position(value: Vector2D) {
         if (value.dist(this.position0) < 1)
            return;
         //value = Math.ceil(value.x / 2).vec(Math.ceil(value.y / 2)).mult(2);
         this.position0 = value;
      }
      commonParent(elem : ui2.Elem) {
         let p0 : ui2.Elem = this;
         let p1 : ui2.Elem = elem;
         while (p0.domDepth() > p1.domDepth())
            p0 = p0.parent;
          while (p1.domDepth() > p0.domDepth())
            p1 = p1.parent;
          (p0.domDepth() == p1.domDepth()).assert();
          let p0x = p0;
          let p1x = p1;
          while (p0 != p1) {
             p0 = p0.parent;
             p1 = p1.parent;
          }
          (p0 == p1).assert();
          return p0;
      }
      positionToParent(parent : ui2.Elem) {
         let pos = Vector2D.Zero;
         let at = this as Elem;
         while (at != parent) {
            pos = pos.add(at.position);
            at = at.parent;
         }
         return pos;
      }

      positionTo(elem: ui2.Elem) {
         let parent = this.commonParent(elem);
         let p0 = this.positionToParent(parent);
         let p1 = elem.positionToParent(parent);
         return p0.minus(p1);
      }
      private size0: Vector2D = Vector2D.Zero;
      get size() { return this.size0; }
      get extent() { return this.position.add(this.size); }
      get rect() { return this.position.rect(this.extent); }
      set size(value: Vector2D) {
         if (value.dist(this.size0) < 1)
            return;
         let oldSz = this.size0;
         this.size0 = value;
         this.sizeChanged(oldSz);
      }
      protected sizeChanged(old: Vector2D) { this.invalidate(); }
      protected renderLocal(g: Render2D): void { }
      protected renderLast(g: Render2D): void { }

      protected get clipOn() { return true; }

      rounding(): number | number[] { return null; }
      protected get useSize() { return this.size; }

      protected renderBorder(g: Render2D) {
         g.strokeStyle = this.foreground;
         g.lineWidth = this.border.thickness;
         let pos = this.border.thickness.vec(this.border.thickness).div(2); // this.borderThickness.vec(this.borderThickness);
         let ext = this.useSize.minus(pos);
         if (!this.border.noRight && !this.border.noBottom) {
            g.strokeRect(pos.rect(ext), this.rounding());
         }
         else {
            g.strokeLine([pos, ext.setY(pos.y)]);
            g.strokeLine([pos, ext.setX(pos.x)]);
            if (!this.border.noRight)
               g.strokeLine([ext, pos.setY(ext.y)]);
            if (!this.border.noBottom)
               g.strokeLine([ext, pos.setX(ext.x)]);
         }
      }
      protected renderBackground(g: Render2D) {
         g.fillStyle = this.background;
         g.fillRect(Vector2D.Zero.rect(this.useSize), this.rounding());
      }
      protected get clip() { return (0).vec().rect(this.size); }
      protected get renderSelectedLast(): boolean { return false; }
      protected applyClip(g : Render2D) {
         g.txt.beginPath();
         let clp = this.clip;
         g.txt.rect(clp.min.x, clp.min.y, clp.max.x, clp.max.y);
         g.txt.closePath();
         g.txt.clip("nonzero");

      }
      protected renderInner(g: Render2D) {
         if (this.background)
            this.renderBackground(g);
         if (this.clipOn) {
            this.applyClip(g);
         }
         this.renderLocal(g);
         if (this.border && this.border.thickness > 0)
            this.renderBorder(g);
         let renderSelectedLast = this.renderSelectedLast;
         for (var c of this.children) {
            if (!renderSelectedLast || this.childSelected != c)
               c.render(g);
         }
         if (renderSelectedLast && this.childSelected) // render child last.
            this.childSelected.render(g);
         this.renderLast(g);
      }
      render(g: Render2D): void {
         if (!this.isVisible())
            return;
         g.txt.save();
         g.txt.translate(this.position.x, this.position.y);
         this.renderInner(g);
         g.txt.restore();
      }
      private selectionListeners: (() => void)[];
      selectionListen(a: () => void) {
         if (!this.selectionListeners)
            this.selectionListeners = new Array<() => void>();
         this.selectionListeners.push(a);
      }
      protected selectionChanged() {
         let at: Elem = this;
         while (at) {
            if (at.selectionListeners) {
               let acts = at.selectionListeners;
               at.selectionListeners = null;
               for (let a of acts)
                  a();
            }
            at = at.parent;
         }
         if (this.parent)
            this.parent.childSelectionChanged();
      }

      loseSelection() {
         if (!this.parent || this.parent.childSelected != this)
            return;
         this.parent.childSelected00 = null;
         this.invalidate();
         if (!this.alwaysSelected) {
            this.loseSelection();
            this.selectionChanged();
         }
      }
      gainSelection() {
         if (this.alwaysSelected) {
            if (this.parent)
               this.parent.childSelected00 = this;
            return;
         }
         if (this.parent.childSelected == this) {
            this.parent.gainSelection();
            return;
         }
         if (this.parent.childSelected)
            this.parent.childSelected.loseSelection();
         (this.parent.childSelected == null).assert();
         this.parent.childSelected00 = this;
         this.invalidate();
         this.gainSelection();
         this.selectionChanged();
      }
      childSelectionChanged() { }
      removedChild(elem: Elem) {
         if (this.childSelected == elem) {
            this.childSelected.loseSelection();
         }
         (this.childSelected == null).assert();
         elem.removed();
      }
      protected removed() {
         for (let c of this.children)
            c.removed();
      }
      public hit(v: Vector2D): Elem {
         v = v.minus(this.position);
         if (!this.size.asRect().contains(v))
            return null;
         let rev = this.children.toArray().reverse();
         for (let c of rev) {
            let h = c.hit(v);
            if (h != null)
               return h;
         }
         return this;
      }
      justSelected: boolean = false;
      protected tryLoseSelection(v: Vector2D) { return true; }
      private checkSelection(v: Vector2D): boolean {
         if (!this.parent)
            return true;
         if (!this.size.asRect().contains(v)) {
            if (this.parent.childSelected == this && this.tryLoseSelection(v)) {
               this.loseSelection();
               (this.parent.childSelected == null).assert();
            }
            return false;
         }
         else if (this.parent.childSelected != this) {
            if (!this.alwaysSelected && this.autoSelect) {
               this.gainSelection();
               (this.parent.childSelected == this).assert();
               this.justSelected = true;
            }
            (!this.autoSelect || this.isSelected).assert();
         }
         else if (this.childSelected) {
            this.childSelected.checkSelection(v.minus(this.childSelected.position))
         }

         return true;
      }
      protected validateSelectedRect(v: Vector2D) {
         return this.size.asRect().contains(v);
      }

      protected pressStartSelected(g: Render2D, v: Vector2D): DragT {
         if (!this.isSelected)
            return null;
         v = v.minus(this.position);
         g.txt.save();
         g.txt.translate(this.position.x, this.position.y);
         let d: DragT = null;
         d = d ? d : this.pressStartSelectedFirst(g, v);
         if (this.childSelected)
            d = d ? d : this.childSelected.pressStartSelected(g, v);
         if (!d)
            for (let c of this.children)
               if (c != this.childSelected && c.isSelected && c.rect.contains(v)) {
                  d = d ? d : c.pressStartSelected(g, v);
                  if (d)
                     break;
               }
         if (!d && (!this.parent || this.validateSelectedRect(v)))
            d = this.pressStartLocalSelected(g, v);
         g.txt.restore();
         let pos0 = this.position;
         return !d ? null : (v, isDrag, isEnd, isHold) => d(v.minus(pos0), isDrag, isEnd, isHold);
      }
      protected pressing = false;

      protected get autoSelect() { return true; }

      protected pressStart(g: Render2D, v: Vector2D): DragT {
         let d: DragT = null;
         v = v.minus(this.position);
         if (!this.checkSelection(v))
            return null;
         g.txt.save();
         g.txt.translate(this.position.x, this.position.y);
         d = d ? d : this.pressStartLocalFirst(g, v);
         let rev = this.children.toArray().reverse();
         for (let c of rev) {
            if (d)
               break;
            d = d ? d : c.pressStart(g, v);
         }
         d = d ? d : this.pressStartLocal(g, v);
         g.txt.restore();
         if (d) {
            let p0 = this.position;
            return (v, isDrag, isEnd, isHold) => d(v.minus(p0), isDrag, isEnd, isHold);
         }
         return null;
      }
      protected pressStartSelectedFirst(g : Render2D, v : Vector2D) : DragT { return null; }
      protected pressStartLocal(g: Render2D, v: Vector2D): DragT { return null; }
      protected pressStartLocalFirst(g: Render2D, v: Vector2D): DragT { return null; }
      protected pressStartLocalSelected(g: Render2D, v: Vector2D): DragT { return null; }
      simplePress(act: () => void): DragT {
         let self = this;
         return (v, isDrag, isEnd) => {
            if (!isDrag && !isEnd && !self.pressing) {
               self.pressing = true;
               self.invalidate();
               return true;
            }
            if (isDrag && self.pressing) {
               self.pressing = false;
               return true;
            }
            if (self.pressing && isEnd) {
               act();
               self.pressing = false;
               return true;
            }
            if (isEnd && this.pressing) {
               this.pressing = false;
               return true;
            }
            return false;
         }
      }

      doScroll(offsetY: number): boolean { return false; }
      doKey(key: KeyboardEvent, g : Render2D): boolean { return false; }
      doCtrl(key: KeyboardEvent, g : Render2D, start : boolean) : boolean  { return false; }
      doShift(key: KeyboardEvent, g : Render2D, start : boolean) : boolean  { return false; }
      invalidate() {
         if (this.parent)
            this.parent.invalidate();
      }
      static font = Font.make(f => {
         f.family = "HelveticaNeue-Light";
         f.size = 17;
      })
      fixedSz(g: Render2D) {
         let ret = this.fixed(g);
         this.size = ret;
         return ret;
      }
      fixed(g: Render2D) { return (-1).vec(-1); }

      find<T extends IBrandable>(brand: Brand<T>, P?: (on: T) => boolean): T {
         if (!this.parent)
            return null;
         else return this.parent.find(brand, P);
      }
   }
   export function addChild<T extends Elem, S extends T>(
      elem: Elem & { readonly children: T[] }, value: S): S {
      elem.children.push(value);
      return value;
   }
   export function removeChild<T extends Elem>(
      elem: Elem & { readonly children: T[] }, index: number): T {
      let value = elem.children[index];
      elem.children.splice(index, 1);
      elem.parent.removedChild(value);
      elem.invalidate();
      return value;
   }
   export function setChild<T extends Elem>(
      self: Elem & { child: T }, value: T): T {
      (!value || value.parent == self).assert();
      if (self.child == value)
         return value;
      let oldChild = self.child;
      self.child = value;
      if (oldChild)
         self.removedChild(oldChild);
      self.invalidate();
      return value;
   }
}