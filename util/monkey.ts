function assert(b: boolean) {
   if (b == false) {
       debugger;
      console.debug("FAIL FAIL");
      throw new Error();
   }
}
interface Equals<T> {
   equals(value : T) : boolean;
}
interface Boolean extends Equals<boolean> {
   assert(): void;
   readonly not: boolean;
}
function max(n : Iterable<number>) {
   let m = -1;
   for (let e of n)
      m = m.max(e);
   return m;
}

interface QuantityBrand {
   readonly isQuantity : true;
}

abstract class Quantity<T extends Quantity<T>> extends Object implements Equals<T>, QuantityBrand {
   abstract zero(): T;
   get isQuantity(): true { return true; }
   self(): T { return this as any; }
   abstract add(by: T): T;
   adds(...bys: T[]) {
      let ret = this as any as Quantity<T>;
      for (let by of bys)
         ret = ret.add(by) as any as Quantity<T>;
      return ret as any as T;
   }
   abstract minus(by: T): T;
   abstract mult(by: number): T;
   abstract div(by: number): T;
   // protected abstract lengthSq0() : number;
   abstract lengthSq(): number;
   length() { return Math.sqrt(this.lengthSq()); }
   normal() { return this.length() > 0 ? this.div(this.length()) : this; }
   distSq(by: T) { return this.minus(by).lengthSq(); }

   dist(by: T) { return Math.sqrt(this.distSq(by)); }
   equals(other: T) { return other != null && this.dist(other) < .001; }
   lerp(to: T, by: number)
   { return this.add(to.minus(this.self()).mult(by)); }
   abstract max(other: T): T;
   abstract min(other: T): T;
   clamp(min: T, max: T): T { return this.max(min).min(max); }
   abstract round(): T;
   snap(n: number) {
      return this.mult(n).round().div(n);
   }
   get adbg() { return this.toString(); }
   abstract abs(): T;
}
interface Comparable<T extends Comparable<T>> {
   compareTo(other : T) : 1|-1|0;
}
interface Number extends Equals<number> {
   readonly isQuantity: true; 
   max(other : number) : number;
   min(other : number) : number;
   clamp(min : number, max : number) : number;
   sqrt(): number;
   square(): number;
   equals(other : number) : boolean;
   round() : number;
   dist(other : number) : number;
   snap(by : number) : number;
   abs() : number;
   zero() : number;
   add(by : number) : number;
   minus(by : number) : number;
   mult(by : number) : number;
   div(by : number) : number;
   length() : number;
   lengthSq() : number;
   distSq(other : number) : number;
   normal() : number;
   lerp(to : number, d : number) : number;
   adds(...by : number[]) : number;
   self() : number;
   compareTo(other : number) : 1|-1|0;
}


interface String extends Equals<string> {
   last(n?: number): string;
   findCloseBrace(open: string, close: string): number;
   isAlpha(idx?: number): boolean;
   isDigit(idx?: number): boolean;
   isStartOfId(idx: number): boolean;
   isWhitespace(idx?: number): boolean;
   take(idx: number, p: (charAt: string) => boolean): number;
   parseInt(): number;
   reverse() : string;
}

interface ReadonlyArray<T> extends IterableExt<T> {
   last(n? : number): T;

}

interface Array<T> extends IterableExt<T>, Equals<Array<T>> {
   findm(f: (a: T, b: T) => boolean): T;
   mapRing<S>(f: (a: T, b: T) => S): Array<S>;
   get(idx: number, rollover?: boolean): T;
   delete(e: T): boolean;
   clear(): void;
   last(n?: number): T;
   avg(): T;
   skip(n : number) : Array<T>;
   equals(other : Array<T>) : boolean;
   copy() : Array<T>;
}
interface ReadonlyArray<T> {
   copy() : ReadonlyArray<T>;
}
function flatten<T>(i : Iterable<Iterable<T>>) {
   return i.reducei((a,b) => a.concati(b), [] as Iterable<T>);
}
function deepEquals<T>(a : T[], b : T[], eq? : (a: T, b: T) => boolean) {
   if (!eq)
      eq = (a,b)=> a== b;
   if (a.length != b.length)
      return false;
   for (let i = 0; i < a.length; i += 1) {
      if (!eq(a[i], b[i]))
         return false;
   }
   return true;
}


function flattenF<T>(i : Iterable<(a : T) => T>) {
   return i.reducei((a,b) => {
      if (!a)
         return b;
      else if (!b)
         return a;
      else return (x : T) => {
         return b(a(x));
      }
   }, null as (a : T) => T);
}


interface Iterable<T> {
   skip(n: number): Iterable<T>;
   mapi<S>(f: (arg: T) => S): Iterable<S>;
   format(f?: (arg: T) => string, delim?: string): string;
   reducei<S>(f: (accum: S, a: T) => S, zero: S): S;
   filteri(p: (arg: T) => boolean): Iterable<T>;
   first(): T;
   take(n : number): T[];
   isEmpty(): boolean;
   findi(p: (t: T) => boolean): T;
   count(): number;
   toArray(): T[];
   until(p: T | ((t: T) => boolean)): Iterable<T>;
   concati(other: Iterable<T>): Iterable<T>;
   somei(p: (elem: T) => boolean): boolean;
   findIndexi(elem : T): number;
   sum(zero?: T):  T extends QuantityBrand ? T : void;
   lasti(): T;

}
interface IterableIterator<T> extends IterableExt<T> {
}
abstract class IterableExt<T> implements Iterable<T> {
   abstract [Symbol.iterator](): Iterator<T>;
   format(f?: (arg: T) => string, delim?: string) {
      let str = "";
      if (!f)
         f = a => "" + a;
      if (!delim && delim != "")
         delim = ", ";
      let first = true;
      for (let e of this) {
         if (!first)
            str += delim;
         first = false;
         str += f(e);
      }
      return str;
   }
   skip(n: number): Iterable<T> { return new SkipIterable<T>(this, n); }
   take(n : number): T[] { 
      let self = this as IterableExt<T>;
      let ret = new Array<T>();
      let count = 0;
      for (let e of self) {
         if (count == n)
            return ret;
         count += 1;
         ret.push(e);
      }
      return ret;
   }
   first(): T {
      for (let e of this)
         return e;
      return null;
   }
   isEmpty() {
      for (let e of this)
         return false;
      return true;
   }
   mapi<S>(f: (arg: T) => S): Iterable<S> {
      return new MapIterable<T, S>(this, f);
   }
   reducei<S>(f: (accum: S, a: T) => S, zero: S) {
      let v = zero;
      for (let e of this)
         v = f(v, e);
      return v;
   }
   filteri(p: (arg: T) => boolean): Iterable<T> {
      return new FilterIterable(this, p);
   }
   findi(p: (arg: T) => boolean) {
      let self = this as any as Iterable<T>;
      for (let t of self) {
         if (p(t))
            return t;
      }
      return null;
   }
   count() { return this.reducei((a, b) => a + 1, 0); }
   toArray() {
      let ret = new Array<T>();
      for (let e of this)
         ret.push(e);
      return ret;
   }
   private *until0(p: T | ((t: T) => boolean)): Iterator<T> {
      let q: (t: T) => boolean;
      if ((p as (t: T) => boolean).apply)
         q = p as (t: T) => boolean;
      else {
         let p0 = p as T;
         q = (t) => t == p0;
      }
      for (let e of this) {
         if (q(e))
            break;
         yield e;
      }
   }
   until(p: T | ((t: T) => boolean)): Iterable<T> { return new IterableImpl(() => this.until0(p)); }
   concati(other: Iterable<T>): Iterable<T> { return new IterableImpl(() => IterableExt.concat0(this, other)); }
   private static *concat0<T>(a: Iterable<T>, b: Iterable<T>): Iterator<T> {
      for (let e of a)
         yield e;
      for (let e of b)
         yield e;
   }
   somei(p: (elem: T) => boolean): boolean {
      for (let o of this)
         if (p(o))
            return true;
      return false;
   }
   findIndexi(elem : T) : number {
      let idx = 0;
      for (let r of this) {
         if (r == elem)
            return idx;
         idx += 1;
      }
      return -1;
   }
   sum(zero? : T) : T extends QuantityBrand ? T : void {
      let zero0 = zero as any;
      let self = this as any as Iterable<Quantity<any>>;
      if (zero0 == null)
         zero0 = 0;
      if (self.isEmpty())
         return zero0;
      if (!zero)
         zero = self.first().zero();
      return self.reducei((a, b) => a.add(b), zero0 as Quantity<any>) as any as (T extends QuantityBrand ? T : void);
   }
   lasti() : T { 
      let last : T;
      for (let t of this) 
         last = t;
      return last;
   }
}
class IterableImpl<T> extends IterableExt<T> {
   constructor(public readonly asIterable: () => Iterator<T>) { super(); }
   [Symbol.iterator](): Iterator<T> { return this.asIterable(); }

}
interface IMap<K,V> extends Iterable<[K,V]> {
   get(key : K) : V;
   has(key : K) : boolean
}
interface Map<K, V> extends IterableExt<[K, V]>, IMap<K,V> { 
   getOrSet(key : K, f: (k : K) => V) : V;
}
interface WeakMap<K extends object,V> {
   getOrSet(key : K, f: (k : K) => V) : V;

}
interface ISet<T> extends Iterable<T> {
   has(elem : T) : boolean;
}
interface Set<T> extends IterableExt<T> {
   expand(act: (t: T, set: Set<T>) => void, rem: (t: T) => boolean): void;
   tryAdd(t : T) : boolean;
   delete(t : T) : boolean;
   adds(...t : T[]) : void;
}
class SetExt<T> extends Set<T> {
   expand(act: (t: T, set: Set<T>) => void, rem: (t: T) => boolean): void {
      let toRem = new Array<T>();
      let processed  = new Set<T>();
      while (true) {
         for (let e of this)
            if (rem(e))
               toRem.push(e);
         if (toRem.length == 0)
            break;
         while (toRem.length > 0) {
            let e = toRem.pop();
            this.delete(e);
            if (!processed.has(e)) {
               processed.add(e);
               act(e, this);
            }
         }
      }

   }
}

class WrapIterableIterator<T> extends IterableExt<T> implements IterableIterator<T> {
   constructor(public readonly orig: IterableIterator<T>) {
      super();
      if (orig.return)
         (this as Iterator<T>).return = WrapIterableIterator0.prototype.return;
      if (orig.throw)
         (this as Iterator<T>).throw = WrapIterableIterator0.prototype.throw;
   }
   next(value?: any): IteratorResult<T> {
      let result = this.orig.next(value);
      return { done: result.done, value: result.value ? (result.value) : null };
   }
   [Symbol.iterator](): IterableIterator<T> {
      return new WrapIterableIterator<T>(this.orig[Symbol.iterator]());
   }
}
class WrapIterableIterator0<T> extends WrapIterableIterator<T> {
   return(value?: any): IteratorResult<T> {
      let result = this.orig.return(value);
      return { done: result.done, value: result.value ? (result.value) : null };
   }
   throw(e?: any): IteratorResult<T> {
      let result = this.orig.throw(e);
      return { done: result.done, value: result.value ? (result.value) : null };
   }
}



class MapIterator<T, S> implements Iterator<S> {
   constructor(public orig: Iterator<T>, public f: (arg: T) => S) {
      if (orig.return)
         (this as Iterator<S>).return = MapIterator0.prototype.return;
      if (orig.throw)
         (this as Iterator<S>).throw = MapIterator0.prototype.return;
   }
   next(value?: any): IteratorResult<S> {
      let result = this.orig.next(value);
      return { done: result.done, value: result.value ? this.f(result.value) : null };
   }
}
class MapIterator0<T, S> extends MapIterator<T, S> {
   return(value?: any) {
      let result = this.orig.return(value);
      return { done: result.done, value: result.value ? this.f(result.value) : null };
   }
   throw(e?: any) {
      let result = this.orig.throw(e);
      return { done: result.done, value: result.value ? this.f(result.value) : null };
   }

}


class MapIterable<T, S> extends IterableExt<S> {
   constructor(public orig: Iterable<T>, public f: (arg: T) => S) {
      super();
   }
   [Symbol.iterator](): Iterator<S> {
      return new MapIterator<T, S>(this.orig[Symbol.iterator](), this.f);
   }
   skip(n: number): Iterable<S> { return this.orig.skip(n).mapi(this.f); }
   mapi<T>(f: (arg: S) => T): Iterable<T> {
      return this.orig.mapi((a) => f(this.f(a)));
   }
   first(): S { return this.f(this.orig.first()); }
   isEmpty(): boolean { return this.orig.isEmpty(); }
}

class SkipIterable<T> extends IterableExt<T> {
   constructor(public orig: Iterable<T>, public n: number) { super(); }
   [Symbol.iterator](): Iterator<T> {
      let i = this.orig[Symbol.iterator]();
      for (let j = 0; j < this.n; j += 1)
         i.next();
      return i;
   }
   skip(n: number) { return this.orig.skip(n + this.n); }
}
class FilterIterator<T> implements Iterator<T> {
   constructor(public readonly orig: Iterator<T>, public readonly p: (arg: T) => boolean) {
      if (orig.return)
         (this as Iterator<T>).return = FilterIterator0.prototype.return;
      if (orig.throw)
         (this as Iterator<T>).throw = FilterIterator0.prototype.throw;
   }
   next(value?: any): IteratorResult<T> {
      while (true) {
         let result = this.orig.next(value);
         if (result.value && !this.p(result.value))
            continue;
         return { done: result.done, value: result.value };
      }
   }
}
class FilterIterator0<T> extends FilterIterator<T> {
   return(value?: any): IteratorResult<T> {
      while (true) {
         let result = this.orig.return(value);
         if (result.value && !this.p(result.value))
            continue;
         return { done: result.done, value: result.value };
      }
   }
   throw(e?: any): IteratorResult<T> {
      while (true) {
         let result = this.orig.throw(e);
         if (result.value && !this.p(result.value))
            continue;
         return { done: result.done, value: result.value };
      }
   }
}

class FilterIterable<T> extends IterableExt<T> {
   constructor(public orig: Iterable<T>, public p: (arg: T) => boolean) { super(); }
   [Symbol.iterator](): Iterator<T> {
      return new FilterIterator(this.orig[Symbol.iterator](), this.p);
   }
   skip(n: number) { return this.orig.skip(n).filteri(this.p); }
}
(function () {
   Boolean.prototype.assert = function () {
      let self = (this as boolean).valueOf();
      assert(self);
   }
   Object.defineProperty(Boolean.prototype, "not",  {
      get: function() {
         return !(this as boolean).valueOf();
      }
   })
   Boolean.prototype.equals = function(other : boolean) {
      return (this as boolean).valueOf() == other;
   }
   Number.prototype.equals = function(other : number) {
      return (this as number).valueOf() == other;
   }
   Number.prototype.zero = function () { return 0; }
   Number.prototype.self = Quantity.prototype.self;
   Number.prototype.add = function (by: number) {
      let self = (this as number).valueOf();
      return self + by;
   };
   Number.prototype.adds = Quantity.prototype.adds;
   Number.prototype.minus = function (by: number) {
      let self = (this as number).valueOf();
      return self - by;
   };
   Number.prototype.mult = function (by: number) {
      let self = (this as number).valueOf();
      return self * by;
   };
   Number.prototype.div = function (by: number) {
      let self = (this as number).valueOf();
      return self / by;
   };
   Number.prototype.lengthSq = function () {
      let self = (this as number).valueOf();
      return self * self;
   };
   Number.prototype.length = function () { return (this as number).valueOf(); }
   Number.prototype.normal = function () { return 1; }
   Number.prototype.dist = Quantity.prototype.dist;
   Number.prototype.distSq = Quantity.prototype.distSq;
   Number.prototype.lerp = Quantity.prototype.lerp;
   Number.prototype.max = function (other) { return Math.max(this as number, other); };
   Number.prototype.min = function (other) { return Math.min(this as number, other); };
   Number.prototype.clamp = Quantity.prototype.clamp;
   Number.prototype.round = function () { return Math.round(this as number); };
   Number.prototype.snap = Quantity.prototype.snap;
   Number.prototype.abs = function () { return Math.abs(this as number); }
   Number.prototype.sqrt = function () { return Math.sqrt(this as number); }
   Number.prototype.square = function () { return this * this; }

   Number.prototype.compareTo = function(other) {
      let self = (this as number).valueOf();
      let n = self - other;
      return n < 0 ? -1 : n > 0 ? +1 : 0;
   }
})();
(function () {
   Array.prototype.equals = function(other) {
      let self = this as Array<any>;
      
      return deepEquals(self, other, (a,b) => {
         let a0 = a as Equals<any>;
         let b0 = b as Equals<any>;
         if (a0.equals && b0.equals && a0.equals(b0))
            return true;
         else return a === b;
      });
   }
   Array.prototype.copy = function() {

      let self = this as Array<any>;
      let ret = new Array<any>(self.length);
      for (let i = 0; i< self.length; i += 1)
         ret[i] = self[i];
     return ret;
   }


   Array.prototype.clear = function () {
      let self = this as Array<any>;
      while (self.length > 0)
         self.pop();
   };
   Array.prototype.format = IterableExt.prototype.format;
   Array.prototype.last = function (n) {
      if (!n)
         n = 0;
      let self = (this as Array<any>);
      return self[self.length - n - 1];
   };
   Array.prototype.sum = function (zero) {
      let self = this as Quantity<any>[];
      if (!zero)
         zero = 0;
      if (self.length == 0)
         return zero;
      if (!zero)
         zero = self[0].zero();
      return self.reduce((a, b) => a.add(b), zero as Quantity<any>);
   };
   Array.prototype.avg = function () {
      let self = this as any[];
      return self.sum().div(self.length);
   };
   Array.prototype.delete = function (e) {
      let self = this as any[];
      let i = self.findIndexi(e);
      if (i < 0)
         return false;
      self.splice(i, 1);
      return true;
   };
   Array.prototype.skip = function (n) {
      return (this as any[]).slice(n);
   };
   Array.prototype.take = function (n) {
      return (this as any[]).slice(0, n);
   };
   Array.prototype.mapi = IterableExt.prototype.mapi;
   Array.prototype.reducei = IterableExt.prototype.reducei;
   Array.prototype.filteri = IterableExt.prototype.filteri;
   Array.prototype.findi = IterableExt.prototype.findi;
   Array.prototype.until = IterableExt.prototype.until;
   Array.prototype.concati = IterableExt.prototype.concati;
   Array.prototype.somei = IterableExt.prototype.somei;
   Array.prototype.lasti = function() { return (this as any[]).last(0); }
   Array.prototype.findIndexi = IterableExt.prototype.findIndexi;
   Array.prototype.first = function () {
      let self = this as any[];
      return self.length == 0 ? null : self[0];
   };
   Array.prototype.isEmpty = function () { return (this as any[]).length == 0; }
   Array.prototype.get = function (idx, rollover) {
      let self = this as any[];
      if (rollover) {
         while (idx < 0)
            idx += self.length;
         idx = idx % self.length;
      }
      return self[idx];
   };
   Array.prototype.mapRing = function (f: (a: any, b: any) => any) {
      let self = this as any[];
      let ret = new Array<any>(0);
      for (let i = 0; i < self.length; i += 1)
         ret.push(f(self[i], self[(i + 1) % self.length]));
      return ret;
   };
   Array.prototype.findm = function (f: (a: any, b: any) => boolean) {
      let self = this as any[];
      let ret = null as any;
      for (let e of self) {
         if (ret == null || f(e, ret))
            ret = e;
      }
      return ret;
   };
   Array.prototype.count = function () {
      return (this as Array<any>).length;
   }
   Array.prototype.toArray = IterableExt.prototype.toArray;
})();
(function () {
   Map.prototype.getOrSet = function(k, f) {
      let self = this as Map<any,any>;
      let ret = self.get(k);
      if (ret != undefined)
         return ret;
      ret = f(k);
      self.set(k,ret);
      return ret;
   }
   WeakMap.prototype.getOrSet = function(k, f) {
      let self = this as WeakMap<object,any>;
      let ret = self.get(k);
      if (ret != undefined)
         return ret;
      ret = f(k);
      self.set(k,ret);
      return ret;
   }


   Map.prototype.format = IterableExt.prototype.format;
   Map.prototype.skip = IterableExt.prototype.skip;
   Map.prototype.take = IterableExt.prototype.take;
   Map.prototype.first = IterableExt.prototype.first;
   Map.prototype.isEmpty = IterableExt.prototype.isEmpty;
   Map.prototype.mapi = IterableExt.prototype.mapi;
   Map.prototype.until = IterableExt.prototype.until;
   Map.prototype.concati = IterableExt.prototype.concati;
   Map.prototype.somei = IterableExt.prototype.somei;
   Map.prototype.findIndexi = IterableExt.prototype.findIndexi;
   Map.prototype.reducei = IterableExt.prototype.reducei;
   Map.prototype.filteri = IterableExt.prototype.filteri;
   Map.prototype.findi = IterableExt.prototype.findi;
   Map.prototype.count = IterableExt.prototype.count;
   Map.prototype.toArray = IterableExt.prototype.toArray;
   Set.prototype.sum = IterableExt.prototype.sum;

   Set.prototype.format = IterableExt.prototype.format;
   Set.prototype.skip = IterableExt.prototype.skip;
   Set.prototype.take = IterableExt.prototype.take;
   Set.prototype.first = IterableExt.prototype.first;
   Set.prototype.isEmpty = IterableExt.prototype.isEmpty;
   Set.prototype.mapi = IterableExt.prototype.mapi;
   Set.prototype.until = IterableExt.prototype.until;
   Set.prototype.concati = IterableExt.prototype.concati;
   Set.prototype.somei = IterableExt.prototype.somei;
   Set.prototype.findIndexi = IterableExt.prototype.findIndexi;
   Set.prototype.reducei = IterableExt.prototype.reducei;
   Set.prototype.filteri = IterableExt.prototype.filteri;
   Set.prototype.findi = IterableExt.prototype.findi;
   Set.prototype.count = IterableExt.prototype.count;
   Set.prototype.toArray = IterableExt.prototype.toArray;
   Set.prototype.sum = IterableExt.prototype.sum;
   Set.prototype.expand = SetExt.prototype.expand;

   Set.prototype.tryAdd = function(what : any) {
      let set = this as Set<any>;
      if (!set.has(what)) {
         set.add(what);
         return true;
      }
      else return false;
   }
   Set.prototype.adds = function(...what : any[]) {
      let set = this as Set<any>;
      for (let e of what)
         set.add(e);
   }


   let keys0 = Map.prototype.keys;
   Map.prototype.keys = function () {
      let self = (this as Map<any, any>).valueOf();
      let orig = keys0.call(self);
      return new WrapIterableIterator<any>(orig);
   };
   let values0 = Map.prototype.values;
   Map.prototype.values = function () {
      let self = (this as Map<any, any>).valueOf();
      let orig = values0.call(self);
      return new WrapIterableIterator<any>(orig);
   }



})();
class CharCode {
   public static readonly DA = "A".charCodeAt(0);
   public static readonly DZ = "Z".charCodeAt(0);
   public static readonly Da = "a".charCodeAt(0);
   public static readonly Dz = "z".charCodeAt(0);
   public static readonly D0 = "0".charCodeAt(0);
   public static readonly D9 = "9".charCodeAt(0);
   public static readonly WS = " ".charCodeAt(0);

   static letters() {
      let ret = new Array<number>();
      for (let i = CharCode.DA; i <= CharCode.DZ; i += 1)
         ret.push(i);
      for (let i = CharCode.Da; i <= CharCode.Dz; i += 1)
         ret.push(i);
      return ret;
   }
   static digits() {
      let ret = new Array<number>();
      for (let i = CharCode.D0; i <= CharCode.D9; i += 1)
         ret.push(i);
      return ret;
   }

   static isWhitespace(code: number) { return code == CharCode.WS; }
   static isAlpha(code: number) {
      if (code >= CharCode.DA && code <= CharCode.DZ)
         return true;
      if (code >= CharCode.Da && code <= CharCode.Dz)
         return true;
      return false;
   }
   static isDigit(code: number) {
      return code >= CharCode.D0 && code <= CharCode.D9;
   }
}

(function () {
   String.prototype.equals = function (other : string) {
      return (this as string).valueOf() == other;
   }


   String.prototype.isWhitespace = function (idx?: number) {
      let self = (this as string).charCodeAt(idx ? idx : 0);
      return CharCode.isWhitespace(self);
   }


   String.prototype.isAlpha = function (idx?: number) {
      let self = (this as string).charCodeAt(idx ? idx : 0);
      return CharCode.isAlpha(self);
   }
   String.prototype.isDigit = function (idx?: number) {
      let self = (this as string).charCodeAt(idx ? idx : 0);
      return CharCode.isDigit(self);
   }
   String.prototype.last = function (n) {
      let self = this as string;
      if (!n)
         n = 0;
      if (self.length == 0)
         return "";
      return self[self.length - 1 - n];
   };
   String.prototype.take = function (idx: number, p: (charAt: string) => boolean): number {
      let self = this as string;
      let jdx = idx;
      while (jdx < self.length && p(self[jdx]))
         jdx += 1;
      return jdx - idx;
   }
   // take(idx : number, p : (charAt : string) => boolean) : number;


   // crap
   String.prototype.isStartOfId = function (idx: number) {
      let self = this as string;
      if (idx > 0 && (self.isAlpha(idx) || self.isDigit(idx)))
         return false;
      else return true;
   }
   String.prototype.findCloseBrace = function (open, close) {
      let self = this as string;
      let opened = 0;
      for (let i = 0; i < self.length; i += 1) {
         if (self[i] == open)
            opened += 1;
         else if (self[i] == close) {
            if (opened == 0)
               return i;
            else opened -= 1;
         }
      }
      return -1;
   };
   String.prototype.parseInt = function () {
      let self = this as string;
      let result = Number.parseInt(self);
      if (result.toString() == self)
         return result;
      else return Number.NaN;
   }
   String.prototype.reverse = function() {
      let ret = "";
      let self = this as String;
      for (let i = 0; i < self.length; i += 1) 
         ret += self.last(i);
      return ret;
   }
})();

class Map2<K0,K1,E> extends IterableExt<[K0,K1,E]> {
   private readonly map = new Map<K0,Map<K1,E>>();
   get(k0 : K0, k1: K1) {
      let map0 = this.map.get(k0);
      return map0 ? map0.get(k1) : undefined;
   }
   has(k0 : K0, k1 : K1) { return this.get(k0, k1) != undefined; }
   set(k0 : K0, k1: K1, e : E) {
      let map0 = this.map.getOrSet(k0, ()=>new Map<K1,E>());
      map0.set(k1, e);
   }
   getOrSet(k0 : K0, k1 : K1, f : (k0 : K0, k1 : K1) => E) {
      let map0 = this.map.getOrSet(k0, ()=>new Map<K1,E>());
      return map0.getOrSet(k1, (k1) => f(k0, k1));
      
   }

   [Symbol.iterator](): Iterator<[K0,K1,E]> { 
      let i0 = this.map.mapi(([k,m]) => m.mapi(([k1,e]) => [k,k1,e] as [K0,K1,E]))
      let i1 = i0.reducei((a,b) => a.concati(b), [] as Iterable<[K0,K1,E]>);
      return i1[Symbol.iterator]();
   }
}