// This file implements generic rendering capabilities. 

namespace rn {
   // style configuration goes here. 
   export let font: Font = Font.make(f => {
      f.family = "Helvetica"// "HelveticaNeue";
      f.style = "normal";
      f.weight = "normal"
      f.size = 18;
   });
   // font for code (vs. the normal font)
   export let codeFont: Font = Font.make(f => {
      f.family = "Helvetica" // "HelveticaNeue-Light";
      f.style = "normal";
      f.weight = "normal";
      f.size = 14;
   });
   export let boldCodeFont = codeFont.remake((f) => {
      f.weight = "bold";
   })
   export let italicCodeFont = codeFont.remake((f) => {
      f.style = "italic";
   })

   export let fontColor = RGB.black.lerp(RGB.white, .25);
   export let smallFont = font.remake(f => {
      f.size = f.size / 2;
      f.weight = "bold";
   });
   export let shadow: Shadow = {
      blur: 3.5,
      offset: (+.5).vec(+1),
      color: RGB.black,
   };
   // tolerance used for filtering out hit candidates. 
   export const hitTolerance = 10;
   // radius of a small circle (used for dots of colors).
   export const smallCircleRad = 3;

}

// a temp namespace to define context, where most of the rendering
// magic occurs. Will be combined with rn1 into a public rn namespace. 
// This namespace introduces the following types:
//
// Image: units of rendering, can be immutable (sizes are not recomputed).
//
// Address: address of image being rendering, important for input
// functions that need to distinguish between multiple instances of a 
// possibly immutable image.
// 
// Geom: a geometry used to describe what is being acted on during input. 
//
// Undo, Do, Target, Scrub actions: used for input, usually allow for undoing
// which is useful when exploring how an image can be changed. 
//
// Input: during rendering, an input struct can be provided, describing
// how whatever is being rendering reacts when input occurs. 
//
// Context: passed through during rendering, combines rendering, input, seeking,
// and so on into one unified visitation logic. 
namespace rn0 {
   // images can be immutable so their sizes might not need
   // to be recomputed.
   export interface Image extends Object {
      // a string for debugging, as a property
      // will appear in debugger local variable view,
      // at top since it starts with an "a".
      readonly adbg: string;
      // size is filled in during rendering. 
      size?: Vector2D;
      // renders and returns rendered size. 
      renderCore(txt: Context, m: Address): Vector2D;
   }
   // elements can be duplicated in a scene, but the addresses of these uses is always unique. 
   export interface Address extends Object {
      readonly adbg: string;
      // deep equality needed since addresses are generated during rendering. 
      equals(m: Address): boolean;
      // determine if nesting is occurs. 
      isNestedIn(m: Address): boolean;
   }
   // lightweight geometry class for input handling. 
   export interface Geom {
      // does "at" belong to the geometry relative to the specified pos.
      has(pos: Vector2D, at: Vector2D): boolean;
      // stroke an outline around the geometry relative to a position.
      highlight(pos: Vector2D, clr: RGB, txt: Context): void;
      // left, up, right, down anchor points on the geometry.
      anchors(pos: Vector2D): [Vector2D, Vector2D, Vector2D, Vector2D];
      // center of this geometry relative to position given. 
      center(pos: Vector2D): Vector2D;
   }
   // circular geometry
   function circg(radius: number): Geom {
      return {
         has: (pos, at) => pos.dist(at) <= radius,
         highlight: (pos, clr, txt) => {
            txt.g.strokeCircle(pos, radius, clr);
         },
         anchors: (pos) => {
            return [
               pos.add((-radius).vec(0)),
               pos.add((0).vec(-radius)),
               pos.add((+radius).vec(0)),
               pos.add((0).vec(+radius)),
            ]
         },
         center: (pos: Vector2D) => pos,
      }
   }
   // rectangular geometry.
   function rectg(sz: Vector2D, radius?: number): Geom {
      return {
         has: (pos, at) => pos.vrect(sz).contains(at),
         highlight: (pos, clr, txt) => txt.g.strokeRect(pos.vrect(sz), radius, clr),
         anchors: (pos) => [
            pos.add((0).vec(sz.y / 2)),
            pos.add((sz.x / 2).vec(0)),
            pos.add((sz.x).vec(sz.y / 2)),
            pos.add((sz.x / 2).vec(sz.y)),
         ],
         center: (pos: Vector2D) => pos.add(sz.div(2)),
      }
   }

   // for handling input.
   // Do: a discrete action that can be undone.
   // Target: a drag-target action that can be undone.
   export type Undo = () => void;
   export type Do = (() => [Undo, Address]);
   export type Target = ((m: Address) => (false | Do));
   export type Scrub = (m: Address) => false | (() => void);
   // identify a sub element aside address that identifies an element. 
   export type Label = string;
   // clients use this Input interface to specify input actions they want to 
   // consider along side rendering. 
   export interface Input {
      // address of rendered element.
      readonly addr?: Address;
      // label of rendered sub-element, relevant for hit testing/freezing. 
      readonly label?: Label;
      // input actions. 
      readonly acts?: (
         ["scrub", (() => (Scrub | false))] |
         [("target"), (() => (Target | false))] |
         [("hold" | "click"), (() => (Do | false))] |
         [("left" | "right" | "up" | "down"), (() => Do | false)]
      )[];
   }
   // used for intermediate processing, not exported outside of namespace.
   type InternalInput = {
      label: Label,
      addr: Address,
      target?: Target | false,
      scrub?: true,
      click?: Do | false,
      hold?: Do | false,
      // replaces left,right,up,down in Input.
      cardinal?: (Do | false)[],
   };
   const cardinalDirs = [
      "left", "up", "right", "down",
   ]
   // convert input to internal input, mainly see what is available and what is
   // not. Returns false if nothing to do. 
   function toInternal(input: Input): InternalInput | false {
      const ret: InternalInput = { label: input.label, addr: input.addr };
      let hasAny = false;
      // utility, lets us know if anything is available by setting hasAny
      function thunk<T>(f: (() => T | false) | false) {
         const r = f ? f() : false;
         if (!r)
            return false;
         hasAny = true;
         return r;
      }
      for (let p of input.acts) {
         if (p[0] == "target")
            ret.target = thunk(p[1]);
         else if (p[0] == "scrub") {
            let f = thunk(p[1]);
            if (f) {
               let g = f;
               ret.target = (m: Address) => {
                  let h = g(m);
                  if (!h)
                     return false;
                  let h0 = h;
                  return () => {
                     h0();
                     return [() => { }, m] as [Undo, Address];
                  };
               };
               ret.scrub = true;
            }
         } else if (p[0] == "click")
            ret.click = thunk(p[1]);
         else if (p[0] == "hold")
            ret.hold = thunk(p[1]);
         else {
            const str = p[0];
            const f = p[1] as () => Do | false;
            const g = thunk(f);
            if (!g)
               continue;
            if (!ret.cardinal)
               ret.cardinal = new Array(4);
            const idx = cardinalDirs.indexOf(str);
            ret.cardinal[idx] = g;
         }
      }
      if (hasAny)
         return ret;
      else return false;
   }
   // info for target that must persist in host
   // during a press.
   export interface TargetInfo {
      readonly target: Target;
      readonly label: Label;
      readonly addr: Address;
      readonly scrub: boolean;
      found?: Address;
   }

   // handles book keeping for rendering elements around their renderCore method.
   // also manages all input. A UI omni-bus method with a dynamic scope like the
   // the canvas graphics it wraps. 
   export abstract class Context extends Object {
      // standard graphics (actually wraps Canvas render2D)
      abstract get g(): Render2D;
      // Used if context is being used to query activity at a position
      protected abstract get doAt(): Vector2D | false;
      // Used if context is being used to query an element address.
      protected abstract get doAddr(): [Address, Label] | false;
      // tell context sub-element has address/label being looked for.
      protected abstract foundAddr(posG: Vector2D, geom: Geom): void;
      // Gates the body of an internal press input handler. If press is handled, returns
      // a low level target hander, an overlay render function, and target from input with searched for label 
      // to seed "canTarget"
      protected abstract handlePress(
         f: () => false | [ui2.DragT, (txt: Context) => void, TargetInfo]): void;
      // Ensure that in next frame rendered, the global center of sub element at [m, label] appears
      // at global postion pos. Prevents the frame from "jumping" around during changes caused
      // by input. 
      protected abstract doFreeze(m: Address, label: Label, pos: Vector2D): void;
      // seek an sub-element at position "at" with label for target action.
      protected abstract seekTarget(at: Vector2D): [Do, Vector2D, Geom] | false;
      // indicates that the context is currently in a targetting context.
      protected abstract get canTarget(): false | (TargetInfo);
      protected abstract setTarget(n?: Address): void;
      // tell context sub-element being rendered is the one to be targetted.
      protected abstract foundTarget(act: Do, pos: Vector2D, geom: Geom): void;
      // internal translation value used to compute global addresses. 
      private translation = Vector2D.Zero;
      peekTranslation() { return this.translation; }
      // set if we are just using clipped rendering to compute size. 
      private doSize?: true;
      get isDoingSize() { return this.doSize == true; }
      setDoSize<T>(f: (txt: this) => T) {
         (this.doSize == null).assert();
         this.doSize = true;
         const ret = this.g.clip(Rect2D.Empty, () => f(this));
         this.doSize.assert();
         delete this.doSize;
         return ret;
      }

      protected abstract get hasFoundPress(): boolean;
      // entry point for element rendering. 
      renderImage(e: Image, pos: Vector2D, m: Address) {
         if (this.doAt) {
            // first found policy. 
            // also, if size is missing, has been invalidated. 
            if (this.hasFoundPress || !e.size)
               return;

            // if we are just doing hit testing, then we can skip
            // this element entirely if the hit is out of bounds. 
            let posG = pos.add(this.translation);
            // use custom hit rectangle if available. 
            let rect = posG.vrect(e.size);
            if (!rect.grow(rn.hitTolerance).contains(this.doAt))
               return;
         }
         // return early if we are searching for an address we aren't getting to later. 
         if (this.doAddr && !this.doAddr[0].isNestedIn(m))
            return;
         if (this.doSize) {
            // only compute size if not already known. 
            // size does not change with address. 
            if (!e.size)
               e.size = e.renderCore(this, m);
            return;
         }
         (e.size != null).assert();
         const sz = this.g.translate(pos, () => {
            // just save rather than subtract to reduce FP error.
            const old = this.translation;
            this.translation = this.translation.add(pos);
            const sz = e.renderCore(this, m);
            this.translation = old;
            return sz;
         });
         // size shouldn't change during rendering. 
         if (!e.size) // if size is missing, was invalidated.
            (this.doAt != false).assert();
         else (sz.dist(e.size) < .01).assert();
      }
      // omnibus input handler. 
      private handleInput(posR: Vector2D, geom: Geom, input: Input) {
         // no need to handle input while computing size or if no input. 
         if (this.doSize || !input)
            return;
         const pos = posR.add(this.translation);
         const center = geom.center(pos);
         if (!this.doAt && input.label && input.addr) {
            let doAddr = this.doAddr;
            if (doAddr) { // check to see if sub-element address/label being looked for.
               const [a, b] = doAddr;
               if (a.equals(input.addr) && b.equals(input.label))
                  this.foundAddr(pos, geom);
            }
            let canTarget = this.canTarget;
            if (canTarget) {
               // check to see if we can be targetted to, 
               // giving feedback to the user on where they can target.
               //const [target, label, orig, scrub, exist] = canTarget;
               if (canTarget.scrub || !input.label.equals(canTarget.label)) { }
               else if (canTarget.addr.equals(input.addr)) { }
               else if (canTarget.found && !canTarget.found.equals(input.addr)) { }
               else if (!canTarget.target(input.addr)) { }
               else {
                  // orangered if we are already being targetted, otherwise forestgreen.
                  // note if target doesn't return false, another call is still needed to make soemthing
                  // happen, so we are safe to call it. 
                  geom.highlight(
                     posR,
                     canTarget.found &&
                        canTarget.found.equals(input.addr) ? RGB.orangered :
                        RGB.forestgreen,
                     this
                  );
               }
            }
         }
         // filter out all contexts without a position 
         // or with a position not inside the geometry. 
         if (!this.doAt || !geom.has(pos, this.doAt))
            return;
         if (input.addr && input.label && this.canTarget) {
            // being called in a seek target, no rendering is happening.
            // see if this is the element being looked for. 
            const [target, label] = [this.canTarget.target, this.canTarget.label];
            if (input.label.equals(label)) {
               const found = target(input.addr);
               // two step activation because we also use
               // for highlighting above without doing. 
               if (found)
                  // communicate found target to seek target caller. 
                  return this.foundTarget(found, pos, geom);
            }
         }
         // nothing else to do if no input actions specified.
         if (!input.acts)
            return;
         const inputx = input; // will reuse input name in a second.
         this.handlePress(() => {
            // convert to internal input, return if nothing really needs to be done.
            const input0 = toInternal(inputx);
            if (!input0)
               return false;
            // reusing name "input" for internal input. 
            const input = input0;
            // if any cardinal actions, compute anchors.
            const anchors = input.cardinal ? geom.anchors(pos) : null;
            // this will be used to target our undo, the action it comes from, and
            // what we are targetting on (if targetting).
            let inProgress: [Do | Target, Undo, [Address, Vector2D, Geom]?];
            // utility to check if freeze is appropriate on specified address.
            const doFreeze = (m: Address, center0?: Vector2D) => {
               // if address is null or input has no label, no freeze.
               if (!input.label || input.scrub)
                  return;
               // freeze to center of geometry.
               this.doFreeze(m, input.label, center0 ? center0 : center);
            }
            let clicked: () => void = null;
            if (input.click) {
               // handle click input first, if any.
               let [undo, m] = input.click();
               // effect immediately captured, undo ready.
               inProgress = [input.click, undo];
               clicked = () => doFreeze(m);
            } else if (input.scrub && input.target && input.addr && input.label) {
               let f = input.target(input.addr);
               if (f) {
                  let [undo, m] = f();
                  inProgress = [input.target, undo, [input.addr, pos, geom]];
               }
            }
            // a low level input handler from my previous UI framework. 
            // handles "hold", "drag" and "end" events, and provides
            // a new position for the mouse/touch/stylus.
            let inputT: ui2.DragT = (v, isDrag, isEnd, isHold) => {
               if (clicked) {
                  clicked();
                  clicked = null;
               }
               if (this.canTarget)
                  delete this.canTarget.found;


               if (isHold && !isDrag && input.hold) {
                  // we are now holding, only relevant if we have hold
                  // behavior defined.
                  if (inProgress) {
                     // we are already doing the hold, 
                     // nothing changed (return false)
                     if (inProgress[0] == input.hold)
                        return false;
                     // undo previous action. 
                     inProgress[1]();
                  }
                  // execute hold behaivor
                  let [undo, m] = input.hold();
                  inProgress = [input.hold, undo];
                  doFreeze(m);
                  return true;
               }
               if (isDrag && anchors) {
                  // anchors activate as the user moves out of the geometry to left/right/up/down 
                  // locations.
                  const check = (idx: number) => {
                     // [left, up, right, down] 
                     // so even deal with x, odd deal with y.
                     let vx = idx % 2 == 0 ? v.x : v.y;
                     let bx = idx % 2 == 0 ? anchors[idx].x : anchors[idx].y;
                     // out for left and up means lesser position. 
                     if (idx <= 1 && vx > bx)
                        return false;
                     // out for right and down means greater position. 
                     else if (idx > 1 && vx < bx)
                        return false;
                     // input interference if target behavior also exists, so cardinal behavior
                     // only activate in a certain buffer zone related to geometry.
                     else if (input.target && bx.dist(vx) > this.g.fontHeight())
                        return false;
                     else return true;
                  };
                  for (let i = 0; i < cardinalDirs.length; i += 1) {
                     if (!check(i))
                        continue;
                     if (inProgress && inProgress[0] == input.cardinal[i])
                        // already doing that
                        return false;
                     if (inProgress)
                        // undo what was previously done.
                        inProgress[1]();
                     let f = input.cardinal[i];
                     if (f) {
                        // behavior exists for direction, do it.
                        let [undo, m] = f();
                        inProgress = [f, undo];
                        doFreeze(m);
                        return true;
                     } else if (inProgress) {
                        // nothing to do but we were doing something,
                        // so reset and notify that something changed.
                        inProgress = null;
                        doFreeze(null);
                        return true;
                     } else return false;
                  }
               }
               if (isDrag) {
                  // mouse is dragging, so anything
                  // not a target will be undone here. 
                  if (inProgress) {
                     if (inProgress[0] == input.target) {
                        // check existing target geometry,
                        // if we are still in it, nothing changed.
                        let [n, w, g] = inProgress[2];
                        if (g.has(w, v))
                           return false;
                     }
                     // undo otherwise. 
                     inProgress[1]();
                  }
                  if (input.target && (input.scrub || !geom.has(pos, v))) {
                     // seek another element, make sure it isn't self by the geom test.
                     let result = this.seekTarget(v);
                     if (result) {
                        // found something.
                        let [act, w, g] = result;
                        let [undo, n] = act();
                        inProgress = [input.target, undo, [n, w, g]];
                        this.setTarget(n);
                        // use a custom center here because we are
                        // freezing the image around the target where hte mouse is now 
                        // and not the actual thing we started dragging from. 
                        doFreeze(n, g.center(w));
                        return true;
                     } else this.setTarget(null);
                  }
                  if (inProgress) {
                     // nothing found.
                     doFreeze(null);
                     inProgress = null;
                     return true;
                  } else return false;
               }
               return false;
            }
            let overlay = (txt: Context) => {
               // overlay executes without translation, so only use global positions
               // here (like pos and anchors).
               // overlay, goes "blue" when we are doing something.
               if (inProgress && !input.scrub)
                  geom.highlight(pos, RGB.dodgerblue, txt);
               if (input.cardinal) {
                  // indicate dots around the boundary for each cardinal action supported. 
                  for (let i = 0; i < 4; i += 1)
                     // use little circles. 
                     if (!input.cardinal[i])
                        continue;
                     else
                        txt.fillSmallCircle(
                           anchors[i],
                           !inProgress ||
                              input.cardinal[i] == inProgress[0] ||
                              inProgress[0] == input.click ? RGB.dodgerblue :
                              RGB.grey);
               }
            }
            return [inputT, overlay, (input.target) ? {
               target: input.target,
               label: input.label,
               addr: input.addr,
               scrub: input.scrub,
            } : null];
         });
      }
      // fill a small circle (system defined) with input (usually just "click")
      fillSmallCircle(center: Vector2D, color: RGB, input?: Input, border?: true) {
         this.g.fillCircle(center, rn.smallCircleRad, color);
         this.handleInput(center, circg(rn.smallCircleRad * 2), input);
         if (border)
            this.g.strokeCircle(center, rn.smallCircleRad);
      }
      // stroke a circle of custom radius with optional centered text and input behavior..
      strokeCircle(
         center: Vector2D,
         radius: number,
         text?: string,
         input?: Input,
         stroke?: RGB
      ) {
         this.g.strokeCircle(center, radius, stroke);
         if (text) {
            // center the text 
            let w = this.g.textWidth(text);
            let x = center.x - w / 2;
            let y = center.y - this.g.fontHeight() * .8 / 2;
            this.g.fillText(text, x.vec(y));
         }
         this.handleInput(center, circg(radius), input);
      }
      // stroke a triangle with optional text and possibly a line over that text. 
      strokeTriangle(
         position: Vector2D,
         length: number,
         text?: [string, boolean],
         input?: Input
      ): Vector2D {
         let posA = position.addY(length);
         let posB = posA.addX(length);
         let posC = (position.x + length / 2).vec(position.y);
         this.g.strokeLine([posA, posB, posC, posA]);
         if (text) {
            let w = this.g.textWidth(text[0]);
            let p = posC.setY(posA.y).addX(-w / 2).addY(-this.g.fontHeight() * .8);
            this.g.fillText(text[0], p);
            if (text[1]) {
               let a = posA.lerp(posC, .5);
               let b = posB.lerp(posC, .5);
               this.g.strokeLine([a, b]);
            }
         }
         let center = posC.x.vec(position.y + length / 2);
         let radius = length / 2;
         this.handleInput(center, circg(radius), input);
         return posB.minus(position);
      }
      // a filled rectangle, invisible if no color is specified (then it is just used for input)
      fillRect(rect: Rect2D, color?: RGB, input?: Input) {
         if (color)
            this.g.fillRect(rect, null, color);
         let sz = rect.max.minus(rect.min);
         this.handleInput(rect.min, rectg(sz), input);
      }
      // stroke a rectangle, this time with an optional radius, good for buttons.
      strokeRect(rect: Rect2D, radius?: number, color?: RGB, input?: Input) {
         this.g.strokeRect(rect, radius, color);
         let sz = rect.max.minus(rect.min);
         this.handleInput(rect.min, rectg(sz, radius), input);
      }
      // fill in some text, returns a rectangle so we can put an optional border around it,
      // position is relative to center X if "center" is specified.
      fillText(
         pos: Vector2D,
         text: string,
         input?: Input,
         align?: "center",
         clr?: RGB
      ): Rect2D {
         let w = this.g.textWidth(text);
         if (align == "center")
            pos = pos.addX(-w / 2);
         this.g.fillText(text, pos, clr);
         let h = this.g.fontHeight();
         //let center = pos.add((w / 2).vec(h / 2));
         //let radius = (w / 2).max(h / 2);
         this.handleInput(pos, rectg(w.vec(h)), input);
         return pos.vrect(w.vec(h));
      }

      get SW() { return Math.ceil(this.g.textWidth("X")); }
      get barH() { return this.SW * 3; }
      standardRad(str: string) {
         return Math.ceil(
            (this.g.textWidth(str) * .7).max(this.SW).max(this.g.fontHeight() * .8)
         );
      }
      // create a bar of undoable buttons
      buttonBar(pos: Vector2D, opts: [string, () => ((() => () => void) | false)][]) {
         let sp = this.g.textWidth("X");
         let x = sp;
         let maxY = 0;
         let y = this.g.fontHeight() * .1;

         for (let [s, f] of opts) {
            x = Math.ceil(x);
            let g = f();
            let clr = g ? rn.fontColor : RGB.black.lerp(RGB.white, .8);
            let rect = this.fillText(x.vec(Math.ceil(pos.y + y)), s, null, null, clr);
            let rect0 = rect.min.addX(-sp / 4).rect(rect.max.addX(sp / 4));
            rect0 = rect0.add((0).vec(-this.g.fontHeight() * .1))
            let k: Do | false = !g ? false : () => {
               if (!g)
                  throw new Error();
               let undo = g();
               return [undo, null as Address];
            }
            this.strokeRect(rect0, 3, clr, {
               acts: [
                  ["click", () => k]
               ]
            });
            x += (rect.max.x - rect.min.x) + sp;
            maxY = maxY.max(rect.max.y - rect.min.y);
         }
         return (x).vec(maxY + y);
      }
   }
}

// a temp namespace to define a host UI that holds the lightweight UI being
// render via a context in rn0. Redefines Context from rn0 since it isn't referring
// to rn0 directly. 
namespace rn1 {
   // context used to render things.
   // just a stub for what was implemented in rn0
   export interface Context {
      readonly g: Render2D;
      // put context in a compute size mode.
      setDoSize<T>(f: (txt: Context) => T): T;
      // compute freeze delta (zero if none).
      computeFreezeDelta(f: (txt: Context) => void): Vector2D;
      // implement press logic. 
      doPress(f: (txt: Context) => void): PressInfo | false;
   }
   // info used to maintain a press context, must be
   // stored in host because context should be stateless. 
   export interface PressInfo {
      readonly inner: ui2.DragT;
      readonly overlay?: (txt: Context) => void;
   }

   // a more heavyweight host for doing lightweight UI written according to the previous UI framework. 
   export abstract class Host extends ui2.Elem {
      // make a context for omnibus rendering/input/search
      protected abstract makeContext(g: Render2D, opt?: ["press", Vector2D]):
         Context;
      // render the child element of this host (if any). 
      protected abstract renderChild(pos: Vector2D, txt: Context): Vector2D;
      // store persistant press info, delete when the press is finished. 
      private pressInfo0?: PressInfo;
      protected get pressInfo() { return this.pressInfo0; }
      // font used in rendering is configurable.
      get useFont() { return rn.font; }
      // init graphics to use proper rendering parameters.
      // must be done whanever context is created. 
      protected init(g: Render2D) {
         g.font = this.useFont;
         g.fillStyle = rn.fontColor;
         g.strokeStyle = rn.fontColor;
         g.lineWidth = 1;
      }
      // offset for rendering, to prevent image from being too close to barrier. 
      get offset() { return Vector2D.Zero; }
      // computed freeze delta to displace image during manipulation.  
      private freezeDelta = Vector2D.Zero;
      protected renderLocal(g: Render2D) {
         super.renderLocal(g);
         g.translate(this.offset, () => {
            let txt = this.makeContext(g);
            // compute sizes.
            txt.setDoSize((txt) => this.renderCore(txt));
            // and freeze delta (if any)
            this.freezeDelta = Vector2D.Zero;
            this.freezeDelta = txt.computeFreezeDelta((txt) => this.renderCore(txt));
            this.renderCore(txt);
         })
      }
      // render an optional header, called by renderCore only.
      protected renderHeader(txt: Context): Vector2D { return Vector2D.Zero; }
      // core rendering method used in many other contexts 
      // (size computation, hit testing, ...)
      protected renderCore(txt: Context): Vector2D {
         let sz = this.renderHeader(txt);
         let sz0 = txt.g.translate(this.freezeDelta, () => {
            return this.renderChild((0).vec(sz.y), txt);
         })
         if (this.pressInfo && this.pressInfo.overlay)
            this.pressInfo.overlay(txt);
         return sz0 ? sz0.addY(sz.y).max(sz) : null;
      }
      // called when a press is finished, so we can cleanup
      // any transient press information stored in the host. 
      protected cleanupPress() { delete this.pressInfo0; }
      // interfacing with more heavy weight input handler. 
      protected pressStartLocal(g: Render2D, v: Vector2D): ui2.DragT {
         this.init(g);
         v = v.minus(this.offset);
         // a press context.
         let txt = this.makeContext(g, ["press", v]);
         (this.pressInfo == null).assert();
         // doing the press logic.
         let ret = txt.doPress((txt) => this.renderCore(txt));
         if (!ret)
            return super.pressStartLocal(g, v);
         this.pressInfo0 = ret;
         // warp input handler to delete pressInfo when press action is ended,
         // stopping their influence on rendering.
         return (w, isDrag, isEnd, isHold) => {
            // don't foget to subtract the offset, none of the code below knows about it.
            w = w.minus(this.offset);
            let ret = this.pressInfo0.inner(w, isDrag, isEnd, isHold);
            if (isEnd)
               this.cleanupPress();
            return ret || isEnd;
         }
      }
   }
}
// combine host and context implementations.
// provide a bit of glue code to make them work together. 
namespace rn {
   export type Input = rn0.Input;
   export type Label = rn0.Label;
   export type Do = rn0.Do;
   export type Target = rn0.Target;
   export type Undo = rn0.Undo;
   type Geom = rn0.Geom;

   export interface Image extends rn0.Image { }
   export interface Address extends rn0.Address { }
   // enhance pressinfo with what 
   interface FreezeInfo {
      readonly addr: Address;
      readonly label: Label;
      readonly from: Vector2D;
      to?: Vector2D;
   }


   interface PressInfo extends rn1.PressInfo {
      // maintain targetting context (if present).
      // freeze context (if present).
      doFreeze?: FreezeInfo; //[Address, Label, Vector2D, Vector2D];
      readonly targetInfo?: TargetInfo;
   }
   export type TargetInfo = rn0.TargetInfo;

   export class Context extends rn0.Context implements rn1.Context {
      constructor(
         readonly g: Render2D,
         readonly host: Host,
         // what is this context really doing if not rendering?
         readonly doAt0?: [("press" | "target"), Vector2D]) {
         super();
      }
      protected get doAt(): false | Vector2D { return this.doAt0 ? this.doAt0[1] : false; }
      // if we are doing an address seek. Unlike doAt0, we make it a temporary property. 
      private doAddr0?: true;
      protected get doAddr(): false | [Address, Label] {
         let df = this.host.pressInfo ? this.host.pressInfo.doFreeze : null;
         if (!this.doAddr0 || !df)
            return false;
         // the address we need is in the host's press information. 
         return [df.addr, df.label];
      }
      protected foundAddr(posG: Vector2D, geom: Geom): void {
         this.doAddr0.assert();
         let center = geom.center(posG);
         this.host.pressInfo.doFreeze.to = center;
      }
      // pressInfo is a set once optional property
      // it is basically used as a return value. 
      protected foundPressInfo?: PressInfo;
      protected get hasFoundPress() { return this.foundPressInfo != null; }
      protected handlePress(f: () =>
         false | [ui2.DragT, (txt: Context) => void, TargetInfo]): void {
         if (!this.doAt0 ||
            this.doAt0[0] != "press" ||
            !this.host.checkEdit() ||
            this.foundPressInfo)
            return;
         let result = f();
         if (!result)
            return;
         let [inner, overlay, targetInfo] = result;
         if (targetInfo != null)
            delete (targetInfo as any).found;
         this.foundPressInfo = {
            inner: inner,
            overlay: overlay,
            targetInfo: targetInfo,
         }
         return;
      }
      doPress(f: (txt: Context) => void): false | PressInfo {
         this.g.clip(Rect2D.Empty, () => f(this));
         // if press is handled during f call, then we will return it here.  
         return this.foundPressInfo ? this.foundPressInfo : false;
      }
      // foundTarget0 is like foundPressInfo, used to convey a return
      // value found during a rendering walk. 
      private foundTarget0?: [Do, Vector2D, Geom];
      protected foundTarget(act: Do, pos: Vector2D, geom: Geom): void {
         (this.doAt0[0] == "target").assert();
         this.foundTarget0 = [act, pos, geom];
      }
      // if we can target, useful during actual rendering and when
      // seeking a target. 
      protected get canTarget(): false | TargetInfo & { found?: Address } {
         if (this.doAt0 && this.doAt0[0] != "target")
            return false;
         if (this.host.pressInfo && this.host.pressInfo.targetInfo)
            return this.host.pressInfo.targetInfo;
         return false;
      }
      protected setTarget(n?: Address): void {
         this.host.pressInfo.targetInfo.found = n;
      }
      protected seekTarget(at: Vector2D) {
         // target seeking, delegated to host because
         // it knows how to render. 
         let txt = this.host.seekTarget(at);
         if (!txt.foundTarget0)
            return false;
         return txt.foundTarget0;
      }

      // freeze something during a press. 
      protected doFreeze(m: Address, label: Label, pos: Vector2D): void {
         if (!m)
            delete this.host.pressInfo.doFreeze;
         else this.host.pressInfo.doFreeze = {
            addr: m, label: label, from: pos,
         }
      }
      // figure out what the freeze delta is:
      // basically the difference between the original position 
      // of what was pressed, and the new position of something
      // specified by address. Keeps the image sane during input.  
      computeFreezeDelta(f: (txt: Context) => void): Vector2D {
         if (!this.host.pressInfo || !this.host.pressInfo.doFreeze)
            return Vector2D.Zero;
         let to = this.host.pressInfo.doFreeze.to; // [3];
         // only need to compute if it hasn't been already. 
         if (to == null) {
            (this.doAddr0 == null).assert();
            // this is where we 
            this.doAddr0 = true;
            this.g.clip(Rect2D.Empty, () => f(this));
            delete this.doAddr0;
            to = this.host.pressInfo.doFreeze.to;
         }
         return this.host.pressInfo.doFreeze.from.minus(to);
      }
   }
   export abstract class Host extends rn1.Host {
      // shuts down editing for rendered part of an image 
      // by returning false. 
      checkEdit() { return true; }
      // element to be rendered as the host's main child.
      makeContext(g: Render2D, opt?: ["target" | "press", Vector2D]): Context {
         this.init(g);
         return new Context(g, this, opt);
      }
      /*
      abstract get child(): [Image, Address];
      renderChild(pos: Vector2D, txt: Context): Vector2D {
         let p = this.child;
         if (!p)
            return Vector2D.Zero;
         let [elem, m] = p;
         txt.renderImage(elem, pos, m);
         return elem.size;
      }
      */
      seekTarget(at: Vector2D): Context {
         let g = this.top().g;
         this.init(g);
         let txt = this.makeContext(this.top().g, ["target", at]);
         g.clip(Rect2D.Empty, () => this.renderCore(txt));
         return txt;
      }
      // upgrade the reference to PressInfo. 
      get pressInfo() { return super.pressInfo as PressInfo; }



   }

}

// testing rendering with nothing else!
namespace rntest {
   class AddressElem extends Object {
      get adbg() { return this.name; }
      toString() { return this.adbg; }
      constructor(readonly name: string,
         readonly getFromParent: (e: Image) => Image,
         readonly setFromParent: (e: Image, child: Image) => Image) {
         super();
      }
   }
   const left = new AddressElem("left", e => e.left, (a, b) => a.setLeft(b));
   const right = new AddressElem("right", e => e.right, (a, b) => a.setRight(b));
   function root(at: Image): AddressElem {
      return new AddressElem("root", () => at, () => { throw new Error() });
   }


   class Address extends Object implements rn.Address {
      readonly length: number;
      readonly image: Image;
      constructor(readonly previous: Address, readonly at: AddressElem) {
         super();
         this.length = (previous ? previous.length : 0) + 1;
         this.image = at.getFromParent(previous ? previous.image : null);
      }
      get adbg(): string {
         return (this.previous ? this.previous.adbg + "." : "") + this.at.name;
      }
      toString() { return this.adbg; }
      protected make(previous: Address, at: AddressElem) {
         return new Address(previous, at);
      }
      push(at: AddressElem) { return this.make(this, at); }
      equals(m: Address): boolean {
         if (this.length != m.length)
            return false;
         let [a, b] = [this as Address, m];
         while (true) {
            if (!a) {
               (!b).assert();
               return true;
            }
            if (a.at != b.at)
               return false;
            a = a.previous;
            b = b.previous;
         }
      }
      isNestedIn(m: Address): boolean {
         let a = this as Address;
         if (a.length < m.length)
            return false;
         (a.length >= m.length).assert();
         while (a.length > m.length)
            a = a.previous;
         return a.equals(m);
      }
      replace(elem: Image): Address {
         if (this.previous == null)
            return this.make(this.previous, elem.asRoot);
         let newParent = this.at.setFromParent(this.previous.image, elem);
         let a = this.previous.replace(newParent);
         return this.make(a, this.at);
      }
   }



   interface Context extends rn.Context {
      readonly host: Host; // upgrade.
   }
   export class Host extends rn.Host {
      public child: [Image, Address];
      constructor(readonly parent: ui2.Top, child0: Image) {
         super();
         this.parent.child = this;
         this.child = [child0, new Address(null, child0.asRoot)];
      }
      reset(address: Address) {
         while (address.previous != null)
            address = address.previous;
         this.child = [address.image, address];
      }
      renderChild(pos: Vector2D, txt: Context): Vector2D {
         let p = this.child;
         if (!p)
            return Vector2D.Zero;
         let [elem, m] = p;
         txt.renderImage(elem, pos, m);
         return elem.size;
      }
   }

   class Image extends Object implements rn.Image {
      size: Vector2D;
      get adbg() { return this.name; }
      anchorX: number = 0;
      readonly asRoot: AddressElem;
      constructor(readonly name: string, readonly left?: Image, readonly right?: Image,
         public down?: Image, public click?: Image, public hold?: Image, public up?: Image) {
         super();
         this.asRoot = root(this);
      }
      setLeft(left: Image) {
         return new Image(this.name, left, this.right);
      }
      setRight(right: Image) {
         return new Image(this.name, this.left, right);
      }
      private static doX(e: Image, txt: Context, m: Address): false | rn.Do {
         if (!e)
            return false;
         else return (() => {
            let n = m.replace(e);
            txt.host.reset(n);
            return [() => {
               txt.host.reset(m);
            }, n];
         });
      }


      renderCore(txt: Context, m: Address): Vector2D {
         let r = txt.g.textWidth(this.name).max(txt.SW * 2);
         let center = this.anchorX.vec(r);
         txt.strokeCircle(center, r, this.name, {
            label: "main",
            addr: m,
            acts: [
               ["down", () => Image.doX(this.down, txt, m)],
               ["up", () => Image.doX(this.up, txt, m)],
               ["click", () => Image.doX(this.click, txt, m)],
               ["hold", () => Image.doX(this.hold, txt, m)],
            ]
         });
         txt.fillText(center.addY(r), "*", {
            label: "axis",
            addr: m,
            acts: [
               ["target", () => {
                  let tg: rn.Target = (n: Address) => {
                     (!n.equals(m)).assert();
                     let image = n.image;
                     if (!image.left || !image.right)
                        return false;
                     return () => {
                        let newElem = new Image(image.name, image.right, image.left);
                        let n0 = n.replace(newElem);
                        txt.host.reset(n0);
                        return [() => { txt.host.reset(n); }, n0];
                     }
                  };
                  return tg;
               }]
            ]
         }, "center")


         if (!this.left && !this.right) {
            if (txt.isDoingSize)
               this.anchorX = r;
            return (2 * r).vec();
         }
         let h = 2 * r + txt.SW * 3;
         if (this.left && this.right) {
            txt.renderImage(this.left, (0).vec(h), m.push(left));
            let rx = this.left.size.x.max(r) + txt.SW * 1;
            txt.renderImage(this.right, (rx).vec(h), m.push(right));
            // draw lines.
            let la = (this.left.anchorX).vec(h - txt.SW);
            let ra = (rx + this.right.anchorX).vec(h - txt.SW);
            function findC(p: Vector2D) {
               // c - lx + lx = c
               let delta = center.minus(p);
               return delta.normal().mult(delta.length() - r).add(p);
            }
            txt.g.strokeLine([findC(la), la, la.addY(txt.SW)]);
            txt.g.strokeLine([findC(ra), ra, ra.addY(txt.SW)]);
            let w = (rx + this.right.size.x.max(r));
            h += this.left.size.y.max(this.right.size.y);
            if (txt.isDoingSize)
               this.anchorX = la.x.lerp(ra.x, .5);
            return w.vec(h);
         }
         {
            let e = this.left ? this.left : this.right;
            let d = txt.SW * 2;
            let c = center.x + d * (this.left ? -1 : +1);
            // p + l.c = c
            let px = c - e.anchorX;
            txt.renderImage(e, px.vec(h), m.push(this.left ? left : right));
            h += e.size.y;
            let w = e.size.x;
            let centerX = e.anchorX + d * (this.left ? -1 : + 1);

            if (centerX < r) {
               let delta = r - centerX;
               w += delta;
               centerX += delta;
            }
            if (w - centerX < r) {
               let delta = r - (w - centerX);
               w += delta;
            }
            if (txt.isDoingSize)
               this.anchorX = centerX;
            return w.vec(h);
         }
      }
   }

   export function test() {
      let a = new Image("a");
      let b = new Image("b");
      let c = new Image("c", a, b);
      let d = new Image("d", a, b);
      let f = new Image("f", c, d, c);
      let g = new Image("g", f, c);

      c.down = f;
      c.up = g;
      d.hold = f;
      let top = ui2.Top.useWindow();
      let h = new Host(top, g);
      top.renderAll();
      return;
   }


}

namespace rn {
   // a utility class used to display two hosts side by side. 
   export abstract class Split extends ui2.Elem {
      abstract get left(): Host;
      abstract get right(): Host;
      get rightBottom(): Host { return null; }
      get children() {
         let ret = [this.left, this.right];
         if (this.rightBottom)
            ret.push(this.rightBottom);
         return ret;
      }

      get inset() { return 10; }

      renderLocal(g: Render2D) {
         super.renderLocal(g);
         this.left.position = this.inset.vec();
         this.left.size = this.size.setX(g.textWidth("X", rn.font) * 30);
         let sizeY = this.size.y;
         this.right.position = (this.left.position.x + this.left.size.x + this.inset).vec(this.left.position.y);
         if (this.rightBottom) {
            sizeY = this.size.y / 2 - this.inset / 2;
            let rb = this.rightBottom;
            rb.position = this.right.position.addY(sizeY + this.inset);
            rb.size = (this.size.x - this.right.position.x).vec(this.size.y - sizeY - this.inset);
            {
               let div = rb.position.x.vec(rb.position.y - this.inset / 2);
               g.strokeLine([div, div.setX(this.size.x)], { stroke: RGB.black.alpha(.1), lineWidth: this.inset });
            }
         }
         this.right.size = (this.size.x - this.right.position.x).vec(sizeY);
         {
            let div = this.right.position.addX(-this.inset / 2);
            g.strokeLine([div, div.setY(this.size.y)], { stroke: RGB.black.alpha(.1), lineWidth: this.inset });
         }
      }
   }
}