type Constructor<T> = new (...args: any[]) => T;

interface ITup1<A> {
   item1(): A;
}
interface ITup2<A, B> extends ITup1<A> {
   item2(): B;
}
interface ITup3<A, B, C> extends ITup2<A, B> {
   item3(): C;
}
interface ITup4<A, B, C, D> extends ITup3<A, B, C> {
   item4(): D;
}
class MathExt {
   static clamp(on: number, min: number, max: number) {
      return on < min ? min : on > max ? max : on;
   }
}
class Angle extends Quantity<Angle> {
   radians(): number { return this.inPi * Math.PI; }
   private constructor(public inPi: number) {
      super();
      assert(inPi > -1 && inPi <= 1);
   }
   zero() { return Angle.Zero; }
   private inPi2(): number { return (this.inPi < 0) ? this.inPi + 2 : this.inPi; }
   static FromRadians(r: number): Angle { return Angle.FromPi(r / Math.PI); }
   static FromPi(inPi: number): Angle {
      while (inPi <= -1)
         inPi += 2;
      while (inPi > 1)
         inPi -= 2;
      return new Angle(inPi);
   }
   unstraight() {
      let n = Math.abs(this.inPi) * 2;
      let m = Math.round(n);
      return Math.abs(n - m);
   }
   lengthSq() { return this.inPi * this.inPi; }
   mult(by: number) { return Angle.FromPi(this.inPi * by); }
   div(by: number) { return Angle.FromPi(this.inPi / by); }
   add(by: Angle) { return Angle.FromPi(this.inPi + by.inPi); }
   minus(by: Angle) {
      let a = this.inPi;
      let b = by.inPi;

      let dA = a - b;
      if (dA > -1 && dA <= 1)
         return Angle.FromPi(dA);
      if (a < b)
         a += 2;
      else b += 2;
      dA = a - b;
      assert(dA > -1 && dA <= 1);
      return Angle.FromPi(dA);
   }
   negate() { return Angle.FromPi(-this.inPi); }
   static readonly PI = Angle.FromPi(1);
   static readonly Zero = Angle.FromPi(0);
   equals(other: Angle) { return this.inPi === other.inPi; }
   toString() {
      let v = Math.round(this.inPi * 100) / 100;
      return v.toString();
   }
   asVector() { return new Vector2D(Math.cos(this.radians()), Math.sin(this.radians())); }
   dist(a: Angle) { return Math.abs(this.minus(a).inPi); }
   distWise(until: Angle) {
      let s = this.inPi;
      let e = until.inPi;
      while (s >= e)
         e += 2;
      return e - s;
   }
   contains(until: Angle, a: Angle) {
      let from0 = this.inPi;
      let until0 = until.inPi;
      if (from0 < until0)
         return a.inPi >= from0 && a.inPi <= until0;
      else return !(a.inPi <= from0 && a.inPi >= until0);
   }
   isVertical(epsilon: number) {
      let d = Math.abs(Math.abs(this.inPi) - .5);
      return d <= epsilon;
   }
   isHorizontal(epsilon: number) {
      let d: number;
      if (this.inPi < -.5)
         d = Math.abs(this.inPi - -1);
      else if (this.inPi < .5)
         d = this.inPi;
      else d = Math.abs(this.inPi - 1);
      return d <= epsilon;
   }
   private toOne() {
      let r = this.inPi.round();
      return this.inPi.dist(r);
   }
   max(a: Angle) { return this.toOne() > a.toOne() ? this : a; }
   min(a: Angle) { return this.toOne() < a.toOne() ? this : a; }
   round() { return Angle.FromPi(this.inPi.round()); }
   snap(n: number) { return Angle.FromPi(this.inPi.snap(n)); }
   abs() { return Angle.FromPi(this.inPi.abs()); }
}
abstract class Vector<T extends Vector<T>> extends Quantity<T> {
   abstract map(f: (a: number) => number): T;
   abstract map2(other: T, g: (a: number, b: number) => number): T;
   abstract reduce<S>(f: (accum: S, b: number, idx: number) => S, zero: S): S;
   abstract reduce2<S>(other: T, f: (accum: S, b: number, c: number) => S, zero: S): S;
   zero() { return this.map(a => 0); }
   one() { return this.map(a => 1); }
   add(by: T) { return this.map2(by, (a, b) => a + b); }

   minus(by: T) { return this.map2(by, (a, b) => a - b); }
   mult(by: number) { return this.map((a) => a * by); }
   mult2(by: T) { return this.map2(by, (a, b) => a * b); }
   div(by: number) { return this.map((a) => a / by); }
   div2(by: T) { return this.map2(by, (a, b) => a / b); }
   negate() { return this.mult(-1); }
   max(by: T) { return this.map2(by, (a, b) => a.max(b)); }
   min(by: T) { return this.map2(by, (a, b) => a.min(b)); }
   round() { return this.map(a => a.round()); }
   abs() { return this.map(a => a.abs()); }
   sqrt() { return this.map(a => a.sqrt()); }
   lengthSq() { return this.reduce((accum, at) => accum + at.square(), 0); }
   dot(by: T) { return this.reduce2(by, (accum, a, b) => accum + (a * b), 0); }
   private static pretty(x: number) {
      if (x == null)
         return "null";
      if (x == Number.MAX_VALUE)
         return "max";
      if (x == Number.MIN_VALUE)
         return "min";
      return x.snap(100).toString();
   }
   toString(): string { return "(" + this.reduce((accum, b, idx) => accum + (idx == 0 ? "" : ", ") + Vector.pretty(b), "") + ")"; }
   
}
class Vector2D extends Vector<Vector2D> implements ITup2<number, number> {
   constructor(
      public readonly x: number,
      public readonly y: number) {
      super();
      (!Number.isNaN(x) && !Number.isNaN(y)).assert();
      (x != null && y != null).assert();
   }
   asArray() : [number,number] { return [this.x, this.y]; }
   static get Zero() { return (0).vec(0); }
   item1() { return this.x; }
   item2() { return this.y; }
   xy(isX: boolean) { return isX ? this.x : this.y; }
   setXY(isX: boolean, n: number) { return isX ? this.setX(n) : this.setY(n); }
   line(end: Vector2D) { return new Line2D(this, end); }
   lineD(delta: Vector2D) { return new Line2D(this, this.add(delta)); }
   rect(max: Vector2D) { return new Rect2D(this, max); }
   vrect(delta: Vector2D) { return new Rect2D(this, this.add(delta)); }
   map(f: (arg: number) => number) { return f(this.x).vec(f(this.y)); }
   map2(other: Vector2D, f: (arg0: number, arg1: number) => number) { return f(this.x, other.x).vec(f(this.y, other.y)); }
   reduce<S>(f: (accum: S, a: number, idx: number) => S, zero: S) {
      let v = zero;
      v = f(v, this.x, 0);
      v = f(v, this.y, 1);
      return v;
   }
   reduce2<S>(other: Vector2D, f: (accum: S, a: number, b: number) => S, zero: S) {
      let v = zero;
      v = f(v, this.x, other.x);
      v = f(v, this.y, other.y);
      return v;
   }
   static readonly Max = new Vector2D(Number.MAX_VALUE, Number.MAX_VALUE);
   static readonly Min = new Vector2D(Number.MIN_VALUE, Number.MIN_VALUE);
   yx() { return this.y.vec(this.x); }
   perp() { return this.y.vec(-this.x); }
   static mk(x: number, y: number) { return new Vector2D(x, y); }
   project(a: Vector2D, b: Vector2D) {
      const na = a.minus(this);
      const nb = b.minus(this).normal();
      return this.add(nb.mult(na.dot(nb)));
   }
   cross(a: Vector2D) { return this.x * a.y - this.y * a.x; }
   slope(b: Vector2D, isX: boolean) {
      return isX ? this.slopeX(b) : this.slopeY(b);
   }
   slopeX(b: Vector2D) {
      return (b.y - this.y) / (b.x - this.x);
   }
   slopeY(b: Vector2D) {
      return (b.x - this.x) / (b.y - this.y);
   }
   asAngle() { return Angle.FromRadians(Math.atan2(this.y, this.x)); }
   relength(l: number, around?: Vector2D) {
      if (!around)
         around = Vector2D.Zero;
      let v = this.minus(around).normal();
      return v.mult(l).add(around);
   }
   rotate(a: Angle, around?: Vector2D) {
      if (!around)
         around = Vector2D.Zero;
      let v = this.minus(around);
      let to = v.asAngle().add(a);
      let w = to.asVector().mult(v.length());
      return w.add(around);
   }
   static douglasPeucker(list: Array<Vector2D>, epsilon: number, at?: number, to?: number): Array<number> {
      let dmax = 0;
      let index = 0;
      if (!at)
         at = 0;
      if (!to)
         to = list.length - 1;
      if (to <= at + 1) {
         let ret = new Array<number>();
         for (let i = at; i <= to; i += 1)
            ret.push(i);
         return ret;
      }
      let ln = new Line2D(list.get(at), list.get(to));
      let f: (i: number) => number;
      if (ln.length() < epsilon * 2)
         f = (i) => (ln.start.dist(list.get(i)) + list.last().dist(list.get(i))) / 2;
      else f = (i) => ln.dist(list.get(i));
      for (let i = at + 1; i < to; i += 1) {
         let d = f(i);
         if (d > dmax) {
            index = i;
            dmax = d;
         }
      }
      if (dmax > epsilon) {
         let results1 = Vector2D.douglasPeucker(list, epsilon, at, index);
         let results2 = Vector2D.douglasPeucker(list, epsilon, index, to);
         let same = results1.pop();
         if (same !== results2.get(0))
            throw new Error();
         return results1.concat(results2);
      }
      else {
         let ret = new Array<number>();
         ret.push(at);
         ret.push(to);
         return ret;
      }
   }
   static computeTs(points: Array<Vector2D>, start: number, last: number) {
      let totalT = 0;
      let allT = new Array<number>();
      for (let i = start + 1; i < last; i += 1) {
         let v = points.get(i);
         totalT += new Line2D(points.get(i - 1), v).length();
         allT.push(totalT);
      }
      totalT += new Line2D(points.get(last - 1), points.get(last)).length();
      return allT.map(t => t / totalT);
   }
   static searchTs(allT: Array<number>, n: number) {
      let len = Math.abs(allT.get(0) - n);
      let idx = 0;
      for (let i = 1; i < allT.length; i += 1) {
         let len0 = Math.abs(allT.get(i) - n);
         if (len0 <= len) {
            len = len0;
            idx = i;
         }
         else break;
      }
      return idx;
   }
   setX(x: number) { return x.vec(this.y); }
   setY(y: number) { return this.x.vec(y); }
   addX(x: number) { return this.add(x.vec(0)); }
   addY(y: number) { return this.add((0).vec(y)); }

   merge(v: Vector2D, epsilon: number) {
      return new Vector2D(v.x ? v.x : Math.round(this.x / epsilon) * epsilon,
         v.y ? v.y : Math.round(this.y / epsilon) * epsilon);
   }
   asRect() { return (0).vec(0).rect(this); }
}
interface Number {
   vec(y?: number, flip?: boolean): Vector2D;
}
interface Boolean {
   one(): number;
}

abstract class Point3D<T extends Point3D<T>>
   extends Vector<T>
   implements ITup3<number, number, number> {
   constructor(
      public readonly x: number,
      public readonly y: number,
      public readonly z: number) { super(); }
   item1() { return this.x; }
   item2() { return this.y; }
   item3() { return this.z; }
   map(f: (n: number) => number) {
      return this.mk(f(this.x), f(this.y), f(this.z));
   }
   map2(other: T, g: (n: number, m: number) => number) {
      return this.mk(g(this.x, other.x), g(this.y, other.y), g(this.z, other.z));
   }
   reduce<S>(f: (accum: S, a: number, idx: number) => S, zero: S) {
      let v = zero;
      v = f(v, this.x, 0);
      v = f(v, this.y, 1);
      v = f(v, this.z, 2);
      return v;
   }
   reduce2<S>(other: T, f: (accum: S, a: number, b: number) => S, zero: S) {
      let v = zero;
      v = f(v, this.x, other.x);
      v = f(v, this.y, other.y);
      v = f(v, this.z, other.z);
      return v;
   }
   protected abstract mk(x: number, y: number, z: number): T;
}
abstract class Point4D<T extends Point4D<T>>
   extends Vector<T>
   implements ITup4<number, number, number, number> {
   constructor(
      public readonly x: number,
      public readonly y: number,
      public readonly z: number, public readonly w: number) { super(); }
   item1() { return this.x; }
   item2() { return this.y; }
   item3() { return this.z; }
   item4() { return this.w; }
   protected abstract mk(x: number, y: number, z: number, w: number): T;
   map(f: (n: number) => number) {
      return this.mk(f(this.x), f(this.y), f(this.z), f(this.w));
   }
   map2(other: T, g: (n: number, m: number) => number) {
      return this.mk(g(this.x, other.x), g(this.y, other.y), g(this.z, other.z), g(this.w, other.w));
   }
   reduce<S>(f: (accum: S, a: number, idx: number) => S, zero: S) {
      let v = zero;
      v = f(v, this.x, 0);
      v = f(v, this.y, 1);
      v = f(v, this.z, 2);
      v = f(v, this.w, 3);
      return v;
   }
   reduce2<S>(other: T, f: (accum: S, a: number, b: number) => S, zero: S) {
      let v = zero;
      v = f(v, this.x, other.x);
      v = f(v, this.y, other.y);
      v = f(v, this.z, other.z);
      v = f(v, this.w, other.w);
      return v;
   }
}
enum FontStyle {
   normal = 0,
   italic = 1,
   oblique = 2,
}

class Font {
   family: string = "Verdana";
   size: number = 15;
   style: "normal" | "italic" | "oblique" = "normal";
   weight: "normal" | "bold" | "bolder" | "lighter" | 100 | 200 | 300 | 400 | 500 | 600 | 700 | 800 | 900 = "normal";
   private constructor() {
      true.assert();
   }
   static make(g: (f: Font) => void) {
      let f = new Font();
      g(f);
      return f;
   }
   remake(g: (f: Font) => void) {
      return Font.make((f) => {
         f.family = this.family;
         f.size = this.size;
         f.style = this.style;
         f.weight = this.weight;
         g(f);
      });
   }
   toString() {
      let str = "";
      if (this.style != "normal")
         str += this.style + " ";
      if (this.weight != "normal")
         str += this.weight + " ";
      str += this.size.toString() + "px ";
      str += this.family;
      return str;
   }
}
class Random {
   constructor(private seed: number) { }
   next() {
      var x = Math.sin(this.seed++) * 10000;
      return x - Math.floor(x);
   }
   nextN(top : number) {
      let ret = Math.floor(this.next() * top)
      if (ret == top)
         return ret - 1;
      else return ret;
   }
   nextA<S>(array: S[]) {
      return array[(this.next() * (array.length - 1)).round()]
   }
}
class RGB extends Point4D<RGB> {
   constructor(r: number, g: number, b: number, a?: number) {
      super(r, g, b, a ? a : 1);
   }
   toString() {
      function clf(d: number) {
         return Math.floor(MathExt.clamp(d, 0, 1) * 255);
      }
      return "rgba(" + clf(this.r) + ", " + clf(this.g) + ", " + clf(this.b) + ", " + this.a + ")";
   }
   get r() { return this.x; }
   get g() { return this.y; }
   get b() { return this.z; }
   get a() { return this.w; }
   static readonly white = new RGB(1.0, 1.0, 1.0);
   static readonly grey = new RGB(0.5, 0.5, 0.5);
   static readonly black = new RGB(0.0, 0.0, 0.0);
   static rgb(r: number, g: number, b: number) {
      return new RGB(r / 255.0, g / 255.0, b / 255.0);
   }
   static readonly dodgerblue = RGB.rgb(30, 144, 255);
   static readonly strongblue = RGB.rgb(0, 122, 204);
   static readonly pureblue = RGB.rgb(0, 164, 239)
   static readonly orangered = RGB.rgb(255, 63, 0);
   static readonly red = RGB.rgb(255, 0, 0);
   static readonly blue = RGB.rgb(0, 0, 255);
   static readonly green = RGB.rgb(0, 128, 0);
   static readonly purple = RGB.rgb(128, 0, 128);
   static readonly lime = RGB.rgb(0, 255, 0);
   static readonly beige = RGB.rgb(245, 245, 220);
   static readonly floralwhite = RGB.rgb(255, 250, 240);
   static readonly linen = RGB.rgb(250, 240, 230);
   static readonly wheat = RGB.rgb(245, 222, 179);
   static readonly sandybrown = RGB.rgb(244, 164, 96);
   static readonly forestgreen = RGB.rgb(34, 139, 34);
   static readonly darksalmon = RGB.rgb(233, 150, 122);
   static readonly cadetblue = RGB.rgb(95, 158, 160);
   static readonly firebrick = RGB.rgb(178, 34, 34);
   static readonly tuscany = RGB.rgb(204, 102, 51);
   static readonly magenta = RGB.rgb(255, 0, 255);
   static readonly orange = RGB.rgb(255, 165, 0);

   static readonly darkslateblue = RGB.rgb(72, 61, 139);
   static readonly whitesmoke = RGB.rgb(244, 245, 249);
   static readonly darkslategray = RGB.rgb(47, 79, 79);
   static readonly gainsboro = RGB.rgb(220, 220, 220);
   static readonly offwhite = RGB.rgb(243, 243, 243);
   static readonly Palegoldenrod = RGB.rgb(238, 232, 170);
   static readonly goldenrod = RGB.rgb(218, 165, 32);
   static readonly golden = RGB.rgb(171, 101, 38);
   static readonly dimgrey = RGB.rgb(105, 105, 105);
   static readonly verydarkgrey = RGB.rgb(44, 44, 44);
   static readonly pink = RGB.rgb(255,192,203);

   alpha(a: number) { return new RGB(this.r, this.g, this.b, a); }
   protected mk(x: number, y: number, z: number) { return new RGB(x, y, z); }
}
interface Shadow {
   color?: RGB;
   offset?: Vector2D;
   blur?: number;
}
interface Face {
   font?: Font;
   fill?: RGB;
}
class Render2D {
   private static ID = 0;
   public readonly id: number;
   private scale: number;
   public size: Vector2D;
   public readonly txt: CanvasRenderingContext2D;
   constructor(canv: HTMLCanvasElement) {
      this.id = Render2D.ID;
      Render2D.ID += 1;
      this.txt = canv.getContext("2d") as CanvasRenderingContext2D;
   }
   clip<T>(rect : Rect2D, f: () => T) : T {
      //this.strokeRect(rect, 0, {stroke: RGB.red, lineWidth: .5})
      this.txt.save();
      this.txt.beginPath();
      let clp = rect;
      this.txt.rect(clp.min.x, clp.min.y, clp.max.x, clp.max.y);
      this.txt.closePath();
      this.txt.clip("nonzero");
      let ret = f();
      this.txt.restore();
      return ret;
   }


   rotate(center: Vector2D, angle: Angle, f?: () => void) {
      this.txt.translate(center.x, center.y);
      this.txt.rotate(angle.radians());
      if (f) {
         f();
         this.txt.rotate(angle.radians() * -1);
         this.txt.translate(-center.x, -center.y);
         return () => { };
      }
      else return () => {
         this.txt.rotate(angle.radians() * -1);
         this.txt.translate(-center.x, -center.y);
      }
   }

   //private font0 : Font;
   set font(font: Font) {
      let old = this.txt.font;
      let str = font.toString();
      this.txt.font = str;
      //this.font0 = font;
   }
   get font(): Font { throw new Error(); }
   //get font() { return this.font0; }
   setFont<T>(font: Font, f: () => T) {
      let save = this.txt.font;
      this.font = font;
      let ret = f();
      this.txt.font = save;
   }
   setFill<T>(clr: RGB, f: () => T) {
      let save = this.txt.fillStyle;
      this.fillStyle = clr;
      let ret = f();
      this.txt.fillStyle = save;
      return ret;
   }
   setStroke<T>(clr: RGB, f: () => T) {
      let save = this.txt.strokeStyle;
      this.strokeStyle = clr;
      let ret = f();
      this.txt.strokeStyle = save;
      return ret;
   }

   private strokeStyle0: RGB;
   set strokeStyle(clr: RGB) { this.txt.strokeStyle = clr.toString(); this.strokeStyle0 = clr; }
   get strokeStyle(): RGB { return this.strokeStyle0; }

   set face(value: Face) {
      if (value.font)
         this.font = value.font;
      if (value.fill)
         this.fillStyle = value.fill;
   }

   set shadow(value: Shadow) {
      if (!value) {
         this.resetShadow();
         return;
      }
      if (value.color)
         this.shadowColor = value.color;
      if (value.offset)
         this.shadowOffset = value.offset;
      if (value.blur)
         this.shadowBlur = value.blur;
   }

   set shadowColor(clr: RGB) { this.txt.shadowColor = clr.toString(); }
   set shadowOffset(v: Vector2D) {
      this.txt.shadowOffsetX = v.x;
      this.txt.shadowOffsetY = v.y;
   }
   set shadowBlur(value: number) {
      this.txt.shadowBlur = value;
   }
   resetShadow() {
      this.txt.shadowBlur = 0;
      this.txt.shadowColor = null;
      this.txt.shadowOffsetX = 0;
      this.txt.shadowOffsetY = 0;
   }


   set fillStyle(clr: RGB) { this.txt.fillStyle = clr.toString(); }
   set lineWidth(width: number) { this.txt.lineWidth = width; }
   do(act: () => void) {
      this.txt.save();
      act();
      this.txt.restore();
   }
   setSize(sz: Vector2D, scale?: number) {
      if (!scale)
         scale = window.devicePixelRatio;
      let fontSave = this.txt.font;
      let canv = this.txt.canvas;
      canv.width = sz.x * scale;
      canv.height = sz.y * scale;
      canv.style.width = sz.x + "px";
      canv.style.height = sz.y + "px";
      this.txt.scale(scale, scale);
      this.scale = scale;
      this.size = sz;
      this.txt.font = fontSave;
      return this;
   }
   get virtualSize() {
      let x = this.canvas.width / this.scale;
      let y = this.canvas.height / this.scale;
      return x.vec(y);
   }
   get canvas() { return this.txt.canvas; }
   mkImage(sz: Vector2D) {
      let canv = document.createElement("canvas");
      return new Render2D(canv).setSize(sz.min(this.size), this.scale);
   }
   drawImage(g: Render2D, at?: Vector2D) {
      if (!at)
         at = Vector2D.Zero;
      this.txt.drawImage(g.canvas, at.x, at.y, g.canvas.width / g.scale, g.canvas.height / g.scale);
   }
   textWidth(str: string, font?: Font) {
      let save = this.txt.font;
      if (font)
         this.font = font;
      let ret = this.txt.measureText(str).width;
      this.txt.font = save;
      return ret;
   }

   textWidths(str: string, font?: Font) {
      let ret = new Array<number>();
      ret.push(0);
      for (let i = 1; i <= str.length; i += 1) {
         let str0 = str.slice(0, i);
         ret.push(this.textWidth(str0, font));
      }
      return ret;
   }


   charAt(str: string, x: Number, font?: Font): [number, number, number] {
      if (x <= 0)
         return [-1, Number.MIN_VALUE, 0];
      let lastW = 0;
      for (let i = 1; i <= str.length; i += 1) {
         let w = this.textWidth(str.slice(0, i), font);
         if (x <= w)
            return [i - 1, lastW, w];
         lastW = w;
      }
      return [str.length, lastW, Number.MAX_VALUE];
   }

   private apply(args: {
      font?: Font,
      fill?: RGB,
      lineWidth?: number,
      stroke?: RGB,
   } | RGB | Font | number, mode: "stroke" | "fill", useNull?: true): () => void {
      let defaultRet = useNull ? null : () => { };
      if (!args)
         return defaultRet;
      else if (args instanceof RGB) {
         if (mode == "stroke") {
            let stroke = args.toString();
            let save = this.txt.strokeStyle;
            if (stroke == save)
               return defaultRet;
            this.txt.strokeStyle = stroke;
            return () => this.txt.strokeStyle = save;
         }
         else {
            let fill = args.toString();
            let save = this.txt.fillStyle;
            if (fill == save)
               return defaultRet;
            this.txt.fillStyle = fill;
            return () => this.txt.fillStyle = save;
         }
      } else if (args instanceof Font) {
         let font = args.toString();
         let save = this.txt.font;
         if (font == save)
            return defaultRet;
         this.txt.font = font;
         return () => this.txt.font = save;
      } else if (typeof args == "number") {
         if (args == this.txt.lineWidth)
            return defaultRet;
         let save = this.txt.lineWidth;
         this.txt.lineWidth = args;
         return () => this.txt.lineWidth = save;
      } else {
         (useNull == null).assert();
         let a = this.apply(args.font, "stroke", true);
         let b = this.apply(args.fill, "fill", true);
         let c = this.apply(args.stroke, "stroke", true);
         let d = this.apply(args.lineWidth, "stroke", true);
         if (!a && !b && !c && !d)
            return defaultRet;
         else return () => {
            for (let x of [a,b,c,d])
               if (x)
                  x();
         }
      }

   }


   fillText(text: string, at: Vector2D, args?: {
      font?: Font,
      fill?: RGB,
   } | Font | RGB) {
      let save = this.apply(args, "fill");
      this.txt.fillText(text, at.x, at.y);
      save();
   }
   strokeText(text: string, at: Vector2D) {
      this.txt.strokeText(text, at.x, at.y);
   }
   line(start: Vector2D, end: Vector2D) {
      this.txt.moveTo(start.x, start.y);
      this.txt.lineTo(end.x, end.y);
   }
   set onmousedown(value: (v: Vector2D) => void) {
      this.canvas.onmousedown = (ev) => {
         value(this.fev(ev));
      };
   }
   set onmouseup(value: (v: Vector2D) => void) {
      this.canvas.onmouseup = (ev) => {
         value(this.fev(ev));
      };
   }
   set onmousemove(value: (v: Vector2D) => void) {
      this.canvas.onmousemove = (ev) => {
         value(this.fev(ev));
      };
   }
   private fev(ev: MouseEvent) {
      let l = this.canvas.getBoundingClientRect().left;
      let t = this.canvas.getBoundingClientRect().top;
      let x = ev.pageX - l;
      let y = ev.pageY - t;
      return new Vector2D(x, y);
   }
   arc(center: Vector2D, radius: number, start?: Angle, end?: Angle) {
      if (!start) {
         assert(!end);
         if (radius > 10)
            assert(true);
         this.txt.arc(center.x, center.y, Math.abs(radius), 0, 2 * Math.PI, false);
         return;
      }
      assert(!(!start || !end));
      if (!end)
         end = start;
      let s = start.inPi;
      let e = end.inPi;
      if (s >= e)
         e += 2;
      if (s < 0 || e < 0) {
         s += 2;
         e += 2;
      }
      assert(s < e);
      this.txt.arc(center.x, center.y, Math.abs(radius), s * Math.PI, e * Math.PI, radius < 0);
   }
   drawArc(center: Vector2D, radius: number, start?: Angle, end?: Angle) {
      this.txt.beginPath();
      this.arc(center, radius, start, end);
      this.txt.stroke();
   }
   fillCircle(center: Vector2D, radius: number, clr? : RGB) {
      this.txt.beginPath();
      this.arc(center, radius);
      this.txt.closePath();
      let oldStyle = clr ? this.txt.fillStyle : null;
      if (clr)
         this.txt.fillStyle = clr.toString();
      this.txt.fill();
      if (clr)
         this.txt.fillStyle = oldStyle;
   }
   roundedRect(rect: Rect2D, radius: number[], sides?: boolean[]) {
      if (!sides)
         sides = [true, true, true, true];
      let isLeft = sides[0];
      let isTop = sides[1];
      let isRight = sides[2];
      let isBottom = sides[3];



      this.txt.beginPath();
      //
      let lt = rect.min;
      let rb = rect.max;
      let rt = lt.setX(rb.x);
      let lb = lt.setY(rb.y);
      {
         let p0 = lt.add(radius[0].vec(0));
         let p1 = rt.minus(radius[1].vec(0));
         this.txt.moveTo(p0.x, p0.y);
         if (isTop)
            this.txt.lineTo(p1.x, p1.y);
         else
            this.txt.moveTo(p1.x, p1.y);
         let p2 = rt.add((0).vec(radius[1]));
         if (isTop || isRight)
            this.txt.arcTo(rt.x, rt.y, p2.x, p2.y, radius[1]);
         else
            this.txt.moveTo(p2.x, p2.y);
         let p3 = rb.minus((0).vec(radius[2]));
         if (isRight)
            this.txt.lineTo(p3.x, p3.y);
         else
            this.txt.moveTo(p3.x, p3.y);
         let p4 = rb.minus(radius[2].vec(0));
         if (isRight || isBottom)
            this.txt.arcTo(rb.x, rb.y, p4.x, p4.y, radius[2]);
         else
            this.txt.moveTo(p4.x, p4.y);
         let p5 = lb.add(radius[3].vec(0));
         if (isBottom)
            this.txt.lineTo(p5.x, p5.y);
         else
            this.txt.moveTo(p5.x, p5.y);
         let p6 = lb.minus((0).vec(radius[3]));
         if (isBottom || isLeft)
            this.txt.arcTo(lb.x, lb.y, p6.x, p6.y, radius[3]);
         else
            this.txt.moveTo(p6.x, p6.y);
         let p7 = lt.add((0).vec(radius[0]));
         if (isLeft)
            this.txt.lineTo(p7.x, p7.y);
         else
            this.txt.moveTo(p7.x, p7.y);
         if (isLeft || isTop)
            this.txt.arcTo(lt.x, lt.y, p0.x, p0.y, radius[0]);
         else
            this.txt.moveTo(p0.x, p0.y);
      }
      //this.txt.closePath();
   }



   fillRect(rect: Rect2D, radius?: number | number[], fill?: RGB): Rect2D {
      let save = this.apply(fill, "fill");
      if (typeof radius == "number" && radius > 0) {
         this.roundedRect(rect, [radius, radius, radius, radius]);
         this.txt.fill();
      }
      else if (radius && typeof radius != "number") {
         this.roundedRect(rect, radius as number[]);
         this.txt.fill();
      }
      else {
         let min = rect.min.min(rect.max);
         let sz = rect.max.minus(rect.min);
         this.txt.fillRect(min.x, min.y, sz.x, sz.y);
      }
      save();
      return rect;
   }
   strokeRect(rect: Rect2D, radius?: number | number[], args?: {
      stroke?: RGB,
      lineWidth?: number,
   } | RGB | number) {
      let save = this.apply(args, "stroke");
      let sz = rect.max.minus(rect.min);
      if (typeof radius == "number" && radius > 0) {
         this.roundedRect(rect, [radius, radius, radius, radius]);
         this.txt.stroke();
      }
      else if (radius && typeof radius != "number") {
         this.roundedRect(rect, radius as number[]);
         this.txt.stroke();
      }
      else this.txt.strokeRect(rect.min.x, rect.min.y, sz.x, sz.y);
      save();
   }
   lineGeom(vS: [Vector2D, number][]) {
      this.txt.beginPath();
      let first: Vector2D;
      for (let i = 0; i < vS.length; i += 1) {
         let before = vS[i == 0 ? vS.length - 1 : i - 1][0];
         let after = vS[(i + 1) % vS.length][0];
         let corner = vS[i][0];
         let radius = vS[i][1];
         if (before.dist(corner) <= radius)
            continue;
         let j = (i + 1);
         while (after.dist(corner) <= radius) {
            after = vS[(j + 1) % vS.length][0];
            j += 1;
         }
         let p = corner.minus(before);
         p = (p.normal().mult(p.length() - radius)).add(before);
         let q = corner.minus(after);
         q = (q.normal().mult(q.length() - radius)).add(after);
         if (!first) {
            first = p;
            this.txt.moveTo(p.x, p.y);
         }
         else this.txt.lineTo(p.x, p.y);
         this.txt.arcTo(corner.x, corner.y, q.x, q.y, radius);
      }
      this.txt.lineTo(first.x, first.y);
   }

   strokeCircle(center: Vector2D, radius: number, args?: {
      stroke?: RGB,
      lineWidth?: number,
   } | RGB | number) {
      let save = this.apply(args, "stroke");
      this.txt.beginPath();
      this.arc(center, radius);
      this.txt.closePath();
      this.txt.stroke();
      save();
   }


   strokeLine(vS: Iterable<Vector2D>, args?: {
      stroke?: RGB,
      lineWidth?: number,
   } | RGB | number) {
      let save = this.apply(args, "stroke");
      this.txt.beginPath();
      let first = true;
      let last = Vector2D.Zero;
      for (let v of vS) {
         if (!first) {
            this.txt.lineTo(v.x, v.y);
         }
         first = false;
         this.txt.moveTo(v.x, v.y);
         last = v;
      }
      this.txt.closePath();
      this.txt.stroke();
      save();

   }
   fillLine(vS: Iterable<Vector2D>) {
      this.txt.beginPath();
      let first = null as Vector2D;
      for (let v of vS) {
         if (first) {
            this.txt.lineTo(v.x, v.y);
         }
         else {
            this.txt.moveTo(v.x, v.y);
            first = v;
         }
      }
      this.txt.closePath();
      this.txt.fill();
   }

   private static readonly fontHeights = new Map<string, number>();
   fontHeight(font?: Font) {
      let fontStr = font ? font.toString() : this.txt.font;


      if (Render2D.fontHeights.has(fontStr))
         return Render2D.fontHeights.get(fontStr);
      let body = document.getElementsByTagName("body")[0];
      let dummy = document.createElement("div");
      let dummyText = document.createTextNode("01234567890ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmopqrstuvwxyz");
      dummy.appendChild(dummyText);
      let font0 = fontStr.split(" ");
      let idx = font0.findIndex((str) => str.indexOf("px") >= 0);
      dummy.setAttribute("style", "font-family: " + font0.slice(idx + 1).join(" ") + "; font-size: " + font0[idx] + ";");
      body.appendChild(dummy);
      let result = dummy.offsetHeight;
      body.removeChild(dummy);
      Render2D.fontHeights.set(fontStr, result);
      return result;
   };
   static changeColor(img: HTMLImageElement, clr: RGB) {
      img.complete.assert();
      (img.naturalWidth > 0).assert();
      let canvas = document.createElement("canvas");
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      let ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      let map = ctx.getImageData(0, 0, 200, 200);
      let imdata = map.data;
      for (let p = 0, len = imdata.length; p < len; p += 4) {
         let r = imdata[p + 0];
         let g = imdata[p + 1];
         let b = imdata[p + 2];
         (r == 0 && g == 0 && b == 0).assert();
         let a = imdata[p + 3];
         {
            imdata[p + 0] = (clr.r * 255).round();
            imdata[p + 1] = (clr.g * 255).round();
            imdata[p + 2] = (clr.b * 255).round();
            imdata[p + 3] = a;
         }
      }
      ctx.putImageData(map, 0, 0);
      return canvas;
   }
   translate<T>(v: Vector2D, f: () => T) {
      this.txt.save();
      this.txt.translate(v.x, v.y);
      //this.translation = this.translation.add(v);
      let ret = f();
      //this.translation = this.translation.minus(v);
      this.txt.restore();
      return ret;

   }
}

class Rect2D {
   constructor(public min: Vector2D, public max: Vector2D) { }
   static readonly Empty = new Rect2D(Vector2D.Max, Vector2D.Min);
   include(v: Vector2D) { return new Rect2D(this.min.min(v), this.max.max(v)); }
   union(r: Rect2D) { return new Rect2D(this.min.min(r.min), this.max.max(r.max)); }
   get northeast() { return this.min.setX(this.max.x); }
   get southwest() { return this.min.setY(this.max.y); }
   corner(x: number, y: number) {
      let rx = x < 0 ? this.min.x : this.max.x;
      let ry = y < 0 ? this.min.y : this.max.y;
      return rx.vec(ry);
   }
   get top() { return this.min.x.lerp(this.max.x, .5).vec(this.min.y); }
   get bottom() { return this.min.x.lerp(this.max.x, .5).vec(this.max.y); }
   get left() { return this.min.x.vec(this.min.y.lerp(this.max.y, .5)); }
   get right() { return this.max.x.vec(this.min.y.lerp(this.max.y, .5)); }

   grow(n: number) {
      let min = this.min.minus(n.vec());
      let max = this.max.add(n.vec().mult(1));
      if (n < 0) {
         let min0 = min.min(max).max(this.min);
         let max0 = min.max(max).min(this.max);
         min = min0;
         max = max0;
      }
      return new Rect2D(min, max);
   }
   get center() { return this.min.add(this.max.minus(this.min).div(2)); }
   contains(v: Vector2D) {
      return v.x >= this.min.x &&
         v.x <= this.max.x &&
         v.y >= this.min.y &&
         v.y <= this.max.y;
   }
   ignoreX() {
      return new Rect2D(new Vector2D(Number.MIN_VALUE, this.min.y), new Vector2D(Number.MAX_VALUE, this.max.y))
   }
   ignoreY() {
      return new Rect2D(new Vector2D(this.min.x, Number.MIN_VALUE), new Vector2D(this.max.x, Number.MAX_VALUE))
   }
   public static intersects0(a0: number, a1: number, b0: number, b1: number) {
      return { min: Math.max(a0, b0), max: Math.min(a1, b1) };
   }
   get isEmpty() { return this.min.x >= this.max.x || this.min.y >= this.max.y; }
   intersect(other: Rect2D, epsilon?: number) {
      let a: Rect2D = this;
      let b = other;
      if (epsilon) {
         a = a.grow(epsilon);
         b = b.grow(epsilon);
      }
      let x = Rect2D.intersects0(a.min.x, a.max.x, b.min.x, b.max.x);
      let y = Rect2D.intersects0(a.min.y, a.max.y, b.min.y, b.max.y);
      if (x.min >= x.max || y.min >= y.max)
         return Rect2D.Empty;
      return new Rect2D(new Vector2D(x.min, y.min), new Vector2D(x.max, y.max));
   }
   public static overlaps0(minA: number, maxA: number, minB: number, maxB: number) {
      if (minA < minB)
         return minB < maxA;
      else if (minB < minA)
         return maxB > minA;
      else {
         assert(minA == minB);
         return true;
      }
   }
   overlaps(other: Rect2D) {
      return Rect2D.overlaps0(this.min.x, this.max.x, other.min.x, other.max.x) &&
         Rect2D.overlaps0(this.min.y, this.max.y, other.min.y, other.max.y);
   }
   toString() { return "{" + this.min + ", " + this.max + "}"; }
   fit(other: Rect2D, isX: boolean, epsilon: number) {
      function xy(v: Vector2D) { return isX ? v.x : v.y; }
      function xy0(v: Vector2D, w: Vector2D) {
         if (isX)
            return new Vector2D(w.x, v.y);
         else return new Vector2D(v.x, w.y);
      }
      function xy1(v: Vector2D, w: Vector2D) {
         if (Math.abs(xy(v) - xy(w)) <= epsilon)
            return xy0(v, w);
         else return v;
      }
      let min = this.min;
      let max = this.max;
      min = xy1(min, other.min);
      min = xy1(min, other.max);
      max = xy1(max, other.min);
      max = xy1(max, other.max);
      return new Rect2D(min, max);
   }
   add(v: Vector2D) {
      return new Rect2D(this.min.add(v), this.max.add(v));
   }
}
class Line2D {
   constructor(public start: Vector2D, public end: Vector2D) {
      assert(this.start != null)
      assert(this.end != null)
   }
   get dbg() { return this.toString(); }
   toString(): string { return this.start + "-" + this.end; }
   delta() { return this.end.minus(this.start); }
   lengthSq() { return this.start.distSq(this.end); }
   length() { return this.start.dist(this.end); }
   lerp(by: number) { return this.start.lerp(this.end, by); }
   perp() { return this.end.minus(this.start).perp(); }
   intersect(other: Line2D): Vector2D | undefined {
      const p = this.start;
      const r = this.delta();
      const q = other.start;
      const s = other.delta();
      const rcrosss = r.cross(s);
      if (rcrosss === 0)
         return undefined;
      const t = q.minus(p).cross(s) / rcrosss;
      // let u = qminusp.cross(r) / rcrosss;
      return p.add(r.mult(t));
   }
   within(p: Vector2D, epsilon?: number) {
      p = this.project(p);
      let l0 = this.start.dist(p);
      let l1 = this.end.dist(p);
      let dist = this.length();
      let delta = Math.abs((l0 + l1) - dist);
      if (!epsilon)
         epsilon = 0.0001;
      return l0 <= epsilon || l1 <= epsilon || delta <= epsilon;
   }
   add(p: Vector2D) {
      return new Line2D(this.start.add(p), this.end.add(p));
   }
   project(a: Vector2D) { return this.start.project(a, this.end); }
   projectSafe(a: Vector2D) {
      let p = this.start.project(a, this.end);
      if (this.within(p))
         return p;
      else if (p.dist(this.start) < p.dist(this.end))
         return this.start;
      else return this.end;
   }
   dist(a: Vector2D) { return this.project(a).dist(a); }
   safedist(a: Vector2D) {
      if (this.within(a))
         return this.dist(a);
      else return this.start.dist(a).min(this.end.dist(a));

   }
   sdist(a: Vector2D) {
      let d = this.dist(a);
      let s = this.sign(a);
      return d * s;
   }
   asAngle() { return this.end.minus(this.start).asAngle(); }
   between(end1: Vector2D) {
      let a0 = this.asAngle();
      let a1 = new Line2D(this.start, end1).asAngle();
      return a0.minus(a1);
   }
   isRight(end1: Vector2D, epsilon?: number) {
      if (!epsilon)
         epsilon = .01;
      let a = this.between(end1);
      return Math.abs(Math.abs(a.inPi) - .5) <= epsilon;
   }
   draw(ctx: Render2D, clr?: RGB, width?: number) {
      ctx.do(() => {
         if (clr) {
            ctx.strokeStyle = clr;
         }
         if (width) {
            ctx.lineWidth = width;
         }
         ctx.txt.beginPath();
         ctx.line(this.start, this.end);
         ctx.txt.stroke();
         ctx.txt.closePath();
      });
   }
   area(a: Vector2D) {
      let p = this.project(a);
      let h = a.dist(p);
      return h * this.length() / 2.0;
   }
   distLine(other: Line2D) {
      let q = this.start.add(this.delta().div(2));
      let p = other.project(q);
      let delta = p.minus(q); // will move linei to linej.
      let linek = this.add(delta);
      if (linek.within(other.start) ||
         linek.within(other.end) ||
         other.within(linek.start) ||
         other.within(linek.end))
         return delta.length();
      let a = this.start.dist(other.start);
      let b = this.start.dist(other.end);
      let c = this.end.dist(other.start);
      let d = this.end.dist(other.end);
      return Math.min(a, b, c, d);
   }
   sign(p: Vector2D) {
      let x = p.x;
      let y = p.y;
      let x1 = this.start.x;
      let y1 = this.start.y;
      let x2 = this.end.x;
      let y2 = this.end.y;
      return Math.sign((x - x1) * (y2 - y1) - (y - y1) * (x2 - x1));
   }
   align(epsilon: number) {
      let start = this.start;
      let end = this.end;
      if (Math.abs(start.x - end.x) <= epsilon) {
         let x = (start.x + end.x) / 2;
         start = x.vec(start.y);
         end = x.vec(end.y);
      }
      if (Math.abs(start.y - end.y) <= epsilon) {
         let y = (start.y + end.y) / 2;
         start = start.x.vec(y);
         end = end.x.vec(y);
      }
      return new Line2D(start, end);
   }
   xAt(y: number) {
      let A = this.start;
      let u = this.delta().asAngle();
      let t = (y - A.y) / Math.cos(u.radians());
      return A.x + (Math.sin(u.radians()) * t);
   }
   yAt(x: number) {
      let A = this.start;
      let u = this.delta().asAngle();
      let t = (x - A.x) / Math.sin(u.radians());
      return A.y + (Math.cos(u.radians()) * t);
   }
   static makeAngle(p: Vector2D, a: Angle) { return this.makeDelta(p, a.asVector()); }
   static makeDelta(p: Vector2D, v: Vector2D) { return new Line2D(p, p.add(v)); }
   radius(height: number) {
      let ret = (height / 2) + (this.lengthSq() / (8 * height));
      //assert(ret > height);
      return ret;
   }
   flip() { return new Line2D(this.end, this.start); }
   setX(x: number) { return new Line2D(this.start.setX(x), this.end.setX(x)); }
   setY(y: number) { return new Line2D(this.start.setY(y), this.end.setY(y)); }
}
class Tri2D extends Object {
   constructor(public a: Vector2D, public b: Vector2D, public c: Vector2D) {
      super();
   }
   static make(vertices: Array<Vector2D>, n: { a: number, b: number, c: number }) {
      return new Tri2D(vertices[n.a], vertices[n.b], vertices[n.c]);
   }
   toString() {
      return this.a + ", " + this.b + ", " + this.c;
   }
   AB() { return new Line2D(this.a, this.b); }
   BC() { return new Line2D(this.b, this.c); }
   CA() { return new Line2D(this.c, this.a); }
   contains(v: Vector2D) {
      let a = Math.sign(this.AB().sign(v));
      let b = Math.sign(this.BC().sign(v));
      let c = Math.sign(this.CA().sign(v));
      return ((a == b) && (b == c));
   }
   render(g: Render2D) {
      g.line(this.a, this.b);
      g.line(this.b, this.c);
      g.line(this.c, this.a);
   }
}
class TableOut {
   static begin() {
      TableOut.lines = new Array<string[]>();
      TableOut.max = null;
   }
   private static lines = new Array<string[]>();
   private static max: number[];
   static debug(...str: string[]) {
      TableOut.lines.push(str);
      let max = str.map(s => s.length);
      if (TableOut.max === null)
         TableOut.max = max;
      else {
         for (let i = 0; i < max.length; i += 1)
            TableOut.max[i] = Math.max(TableOut.max[i], max[i]);
      }
   }
   static end() {
      for (let line of TableOut.lines) {
         let linestr = "";
         for (let i = 0; i < line.length; i += 1) {
            let max = TableOut.max[i];
            let str = line[i];
            str = str.concat(' '.repeat(max - str.length));
            linestr = linestr.concat(str);
         }
         console.debug(linestr);
      }
      TableOut.lines = null;
      TableOut.max = null;
   }
}
(function () {
   Boolean.prototype.one = function () {
      let self = (this as boolean).valueOf();
      return self ? 1 : 0;
   }
   Number.prototype.vec = function (y?: number, flip?: boolean) {
      let self = (this as number).valueOf();
      if (y == null) {
         (y != 0).assert();
         y = self;
      }
      if (flip)
         return new Vector2D(y, self);
      else return new Vector2D(self, y);
   }
})();
abstract class BaseLater {
   abstract seqL<B>(f: () => Later<B>): Later<B>;
   public static empty: BaseLater;
   abstract isDone0(): boolean;
   abstract onDone0(f: () => void): void;
}
class Later<A> extends BaseLater {
   private whenDone = new Array<(value: A) => void>(0);
   private get isDone() { return this.whenDone == null; }
   isDone0() { return this.isDone; }
   private value: A;
   onDone(f: (value: A) => void) {
      if (this.isDone)
         f(this.value);
      else this.whenDone.push(f);
   }
   onDone0(f: () => void) { this.onDone(() => f()); }
   seqL<B>(f: () => Later<B>) { return this.seq(f); }
   seq<B>(f: (value: A) => Later<B>): Later<B> {
      if (this.isDone) {
         let ret = f(this.value);
         if (ret != null)
            return ret;
         else return new Later<B>().done(null);
      }
      let ret = new Later<B>();
      this.onDone(value => {
         let b = f(value);
         if (b == null)
            ret.done(null);
         else b.onDone(value => ret.done(value));
      });
      return ret;
   }
   join(...other: Later<A>[]): Later<A[]> {
      let arr = new Array<A>();
      let ret = new Later<A[]>();
      let all = [this as Later<A>];
      all.push(...other);
      let check = () => {
         if (!ret.isDone && all.every(b => b.isDone))
            ret.done(arr);
      };
      for (let a of all) {
         let aa = a;
         a.onDone((value) => {
            aa.isDone.assert();
            arr.push(value);
            check();
         });
      }
      return ret;
   }
   joinV(...other: BaseLater[]): Later<A> {
      let ret = new Later<A>();
      let done = false;
      let check = () => {
         if (!done && this.isDone && other.every(b => b.isDone0())) {
            ret.done(this.value);
            done = true;
         }
      };
      this.onDone((value) => check());
      for (let a of other)
         a.onDone0(() => check());
      check();
      return ret;
   }
   map<B>(f: (value: A) => B): Later<B> {
      let ret = new Later<B>();
      this.onDone(value => {
         ret.done(f(value));
      });
      return ret;
   }
   done(value: A) {
      assert(!this.isDone);
      this.value = value;
      let fS = this.whenDone;
      this.whenDone = null;
      this.isDone.assert();
      for (let a of fS)
         a(this.value);
      return this;
   }


}

BaseLater.empty = new Later<void>().done(null);

interface Window {
   innerSize(): Vector2D;
}

(function () {
   Window.prototype.innerSize = function () {
      let w = this as Window;
      return new Vector2D(w.innerWidth - 10, w.innerHeight - 10);
   };
})();

class RMap<K, V> {
   private readonly map = new Map<string, V>();
   constructor(public f: (k: K) => string) { }
   has(k: K) { return this.map.has(this.f(k)); }
   get(k: K) { return this.map.get(this.f(k)); }
   set(k: K, v: V) { this.map.set(this.f(k), v); }
   forEach(p: (v: V) => void) {
      this.map.forEach(e => p(e));
   }
}


class Linked<NodeT extends Linked<NodeT>> extends Object {
   next: NodeT;
   prev: NodeT;
   private static AllId = 0;
   readonly id: number;
   constructor() {
      super();
      this.id = Linked.AllId;
      Linked.AllId += 1;
   }
   private self(): NodeT { return this as any as NodeT; }
   insert(after: NodeT) {
      this.prev = after;
      this.next = after.next;
      this.prev.next = this.self();
      if (this.next == null) {
         (after.prev == null).assert();
      }
      else this.next.prev = this.self();
      return this;
   }
   isDeleted() {
      if (!this.prev && !this.next)
         return true;
      else if (!this.prev || !this.next)
         return false;
      else {
         let isD = this.prev.next != this.self();
         (isD == (this.next.prev != this.self())).assert();
         return isD;
      }
   }
   delete() {
      this.isDeleted().not.assert();
      this.next.prev = this.prev;
      this.prev.next = this.next;
   }
   after(): IterableExt<NodeT> {
      return new IterableImpl<NodeT>(() => this.after00());
   }
   before(): IterableExt<NodeT> {
      return new IterableImpl<NodeT>(() => this.before00());
   }
   private *after00() {
      let at = this as any as NodeT;
      while (at) {
         yield at;
         at = at.next;
      }
   }
   private *before00() {
      let at = this as any as NodeT;
      while (at) {
         yield at;
         at = at.prev;
      }
   }
}
class LinkedList<NodeT extends Linked<NodeT>> {
   first: NodeT;
   last: NodeT;
   init(first: NodeT, last: NodeT) {
      this.first = first;
      this.last = last;
      this.first.next = this.last;
      this.last.prev = this.first;
   }
}

abstract class LinkedCursor<NodeT extends LinkedCursor<NodeT>> extends Linked<NodeT> {
   atOrBefore: boolean = false;
   abstract get length(): number;
   isAfterCursor() { return !this.atOrBefore; }
}
class Cursor<NodeT extends LinkedCursor<NodeT>> {
   private at0: NodeT;
   private offset0: number;
   get at() { return this.at0; }
   get offset() { return this.offset0; }
   constructor(first: NodeT) {
      this.at0 = first;
   }
   advance() {
      this.at.atOrBefore.assert();
      if (this.at.next == null)
         return false;
      if (this.offset == -1)
         this.offset0 = 0;
      else this.offset0 += this.at.length;
      this.at0 = this.at.next;
      this.at.atOrBefore.not.assert();
      this.at.atOrBefore = true;
      return true;
   }
   retreat() {
      this.at.atOrBefore.assert();
      if (this.at.prev == null) {
         (this.offset == -1).assert();
         return false;
      }
      this.at.atOrBefore = false;
      this.at0 = this.at.prev;
      if (this.at.prev == null) {
         (this.offset == 0).assert();
         this.offset0 = -1;
      }
      else {
         this.offset0 -= this.at.length;
         (this.offset >= 0).assert();
      }
      return true;
   }
   seekT(tok: NodeT) {
      while (!tok.atOrBefore)
         this.advance().assert();
      tok.atOrBefore.assert();
      while (this.at != tok)
         this.retreat().assert();
      // we are there. 
      (this.at == tok).assert();
   }
   seek(offset: number) {
      while (this.offset > offset)
         this.retreat().assert();
      if (this.offset == -1)
         this.advance().assert();
      while (this.at.next && offset >= this.offset + this.at.length)
         this.advance().assert();
   }
   seekAfter(tok: NodeT, offset: number) {
      this.seekT(tok);
      offset += this.offset + this.at.length;
      this.seek(offset);
   }
}

class Brand<T extends IBrandable> extends Object {
   get adbg() { return this.toString(); }
   constructor(readonly name: string) { super(); }
   toString() { return this.name; }
   find<S extends IBrandable>(self: T, brand: Brand<S>, P?: (on: S) => boolean, up?: (self: T, brand: Brand<S>, P?: (on: S) => boolean) => S): S {
      if (brand as any == this && (!P || P(self as any as S)))
         return self as any as S;
      else if (up)
         return up(self, brand, P);
      else if (self.parent)
         return self.parent.find(brand, P);
      else return null;
   }
}

interface IBrandable {
   find<T extends IBrandable>(brand: Brand<T>, P?: (on: T) => boolean): T;
   readonly parent: IBrandable;
}

interface IStableKey extends Object { readonly isMemoized: true; }
type StableKey = string | number | IStableKey;

class StableSet<T extends { readonly stable: StableKey }> extends IterableExt<T> {
   private readonly under = new Map<any, T>();
   clear() { this.under.clear(); }
   has(item: T) { return this.under.has(item.stable); }
   [Symbol.iterator](): Iterator<T> {
      return this.under.values();
   }

   tryAdd(item: T) {
      let ret = this.under.get(item.stable);
      if (ret)
         return false;
      this.under.set(item.stable, item);
      return true;
   }
   add(...items: T[]) {
      for (let e of items)
         if (!this.under.has(e.stable))
            this.under.set(e.stable, e);
      return this;
   }
   toString() { return this.under.values().format(); }
   get adbg() { return this.toString(); }
}

class StableMap<T extends { readonly stable: StableKey }, S> {
   private readonly under = new Map<any, [T, S]>();
   clear() { this.under.clear(); }
   keys() { return this.under.values().mapi(a => a[0]); }
   values() { return this.under.values().mapi(a => a[1]); }
   entries() { return this.under.values(); }
   get(key: T): S {
      let ret = this.under.get(key.stable);
      if (!ret)
         return undefined;
      return ret[1];
   }
   set(key: T, value: S) { this.under.set(key.stable, [key, value]); }
   has(key: T) { return this.under.has(key.stable); }
   toString() { return this.under.values().format(); }
   get adbg() { return this.toString(); }
}

class FuzzMap<T> extends Object {
   readonly under = new Map<number, [number, T][]>();
   constructor(readonly epsilon: number) { super(); }
   clear() { this.under.clear(); }
   set(value: number, entry: T) {
      let v = (value / this.epsilon).round() * this.epsilon;
      let a = this.under.get(v);
      {
         if (!a) {
            a = [];
            this.under.set(v, a);
         }
         a.push([value, entry])
      }
      if (value <= v) {
         let b = this.under.get(v - this.epsilon);
         if (!b) {
            b = [];
            this.under.set(v - this.epsilon, b);
         }
         b.push([value, entry])
      }
      if (value >= v) {
         let c = this.under.get(v + this.epsilon);
         if (!c) {
            c = [];
            this.under.set(v + this.epsilon, c);
         }
         c.push([value, entry])
      }
   }
   get(value: number): [number, T][] {
      let v = (value / this.epsilon).round() * this.epsilon;
      let ret = [] as [number, T][];
      {
         let a = this.under.get(v);
         if (a)
            ret.push(...a);
      }
      if (value <= v) {
         let b = this.under.get(v - this.epsilon);
         if (b)
            ret.push(...b);
      }
      if (value >= v) {
         let c = this.under.get(v + this.epsilon);
         if (c)
            ret.push(...c);
      }
      return ret;
   }
}

class LazyIterable<T> extends IterableExt<T> {
   constructor(readonly inner: () => Iterable<T>) {
      super();
   }
   [Symbol.iterator](): Iterator<T> {
      return this.inner()[Symbol.iterator]();
   }

}
