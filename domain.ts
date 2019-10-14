
// domain classes for RB tree abstract representation
// independent of rendering or anything else fancy. 

// first, some basic definitions.
// A height is used to describe the height of a tree or 
// subtree. 
// An axis abstracts over what the left and right 
// child of a node are, allowing us to swap them as
// convenient for forming an abstract image of tree
// structure. 
namespace dm {
   // height as in the black node height of a red black tree or sub-tree.
   export type Height = HeightAbstract | HeightConcrete;
   // implement both abstract and concrete heights in same class. 
   export class HeightImpl extends Object {
      // debug printout that appears first in debugger local variable view. 
      get adbg() {
         let h = this.inner;
         if (h instanceof Array)
            return h[0] + (h[1] == 0 ? "" : h[1] < 0 ? " - " + (-h[1]) : " + " + h[1]);
         else return h.toString();
      }
      // number for concrete height, string (var name) + number (modifier) for abstract height.
      private constructor(private readonly inner: number | [string, number]) {
         super();
         (this.inner != 0).assert();
      }
      // add some number to height, usually +1 or -1.
      add(n: number): Height | this {
         if (n == 0) // nothing added.
            return this;
         let h = this.inner;
         if (h instanceof Array)
            return new HeightImpl([h[0], h[1] + n]) as Height;
         else return new HeightImpl(h + n) as Height;
      }
      // height equality is deep.
      equals(other: Height | number): boolean {
         let self = this as Height;
         if (typeof other == "number")
            return this.equals(HeightImpl.concrete(other));
         if (self.tag == "concrete") {
            if (other.tag != "concrete")
               return false;
            return self.concrete == other.concrete;
         } else if (other.tag == "concrete")
            return false;
         else {
            return self.varName == other.varName &&
               self.varAdjust == other.varAdjust;
         }
      }
      // bind v in height to new height h. If height does not refer to v, just return this.
      bind(v: string, h: Height) {
         if (this.inner instanceof Array && this.inner[0] == v)
            return h.add(this.inner[1]);
         else return this;
      }
      // promote height to abstract if concrete (otherwise return false). Var already
      // has a concrete binding to figure out equivalent translation. 
      addAbstract(v: string, n: number): HeightAbstract | false {
         if (this.inner instanceof Array)
            return false;
         return new HeightImpl([v, this.inner - n]) as HeightAbstract;
      }
      static concrete(n: number) { return new HeightImpl(n) as HeightConcrete; }
      static usingVar(v: string, n: number) {
         return new HeightImpl([v, n]) as HeightAbstract;
      }

      get varName() {
         return this.inner instanceof Array ? this.inner[0] : false;
      }
      get varAdjust() {
         return this.inner instanceof Array ? this.inner[1] : false;
      }
      get concrete(): number | false {
         return typeof this.inner == "number" ? this.inner : false;
      }
      get tag(): "concrete" | "var" {
         return typeof this.inner == "number" ? "concrete" : "var";
      }
      // close on all variable names used
      // in image, here just add if 
      allUsed(vars: Set<string>) {
         if (this.inner instanceof Array)
            vars.add(this.inner[0]);
      }
   }
   export interface HeightAbstract extends HeightImpl {
      readonly tag: "var";
      readonly varName: string;
      readonly varAdjust: number;
      readonly concrete: false;
   }
   export interface HeightConcrete extends HeightImpl {
      readonly tag: "concrete";
      readonly varName: false;
      readonly varAdjust: false;
      readonly concrete: number;
   }
   // abstracts over whether the left or right children of a node are 
   // actually swaped or not in concrete examples being abstracted over. 
   export class Axis extends Object {
      get adbg(): string {
         let h = this.inner;
         if (h instanceof Array)
            return h[0];
         return h;
      }
      private constructor(private readonly inner: "+" | "-" | "*" | [string]) {
         super();
      }
      equals(other: Axis) {
         let [pA, pB] = [this.inner, other.inner];
         if (typeof pA == "string")
            return pA == pB;
         else if (typeof pB == "string")
            return false;
         else if (pA[0] != pB[0])
            return false;
         else return true;

      }
      // +: left and right children are not swaped.
      static readonly Plus: Axis = new Axis("+");
      // -: left and right children are swaped.
      static readonly Minus: Axis = new Axis("-");
      // *: left and right children may or may not be swaped.
      static readonly Wild: Axis = new Axis("*");
      // v: like wild, except that swapiness is the same for any
      // nodes in a tree that share "v" as their axis bound.
      static varAxis(v: string): Axis { return new Axis([v]); }
      isVar(): this is AxisWithVar { return this.inner instanceof Array; }
      get varName() {
         return this.inner instanceof Array ? this.inner[0] : false;
      }
      allUsed(vars: Set<string>) {
         if (this.inner instanceof Array)
            vars.add(this.inner[0]);
      }
   }
   export interface AxisWithVar extends Axis {
      readonly varName: string;

   }
}


// introduce actual domain objects for an abstract RB tree representation.
// - Image is a base type for all abstract tree node elements. 
// - Root is any element type that does not have a parent.
// - RootParent represents the RB tree above and aside its node child.
// - JustTree is a root with no child, a full RB tree with no parts exposed.
// - Node is an actual non-nil tree node with a color and two left/right children.
// - Leaf is a compressed subtree.
// 
// Note that compression is an action that eliminates detail from the tree; e.g.
// by compressing a node into a leaf subtree. 
namespace dm {
   // abstract base super class of all abstract RB tree elements. 
   export abstract class Image extends Object {
      abstract get adbg(): string;
      toString() { return this.adbg; }
      // whether or not this element can be compressed into a 
      // form that increases abstraction.
      abstract isCompressible(): boolean;
      // abstract isCompressible(parent?: RootParent | Node): boolean;
      // Compressed form (if any).
      abstract asCompressed(): [Image, Node[]];
      protected allUsed(vars: Set<string>) { }
   }
   // An RB tree's root element that doesn't have a parent. 
   export abstract class Root extends Image { }
   // Any element with an explicit specified height. 
   export interface HasExplicitHeight extends Image {
      readonly height: Height | "empty";
      setHeight(value: Height): this;
   }
   // A root that is the parent of a node.
   export class RootParent extends Root implements HasExplicitHeight {
      get adbg() {
         return "rt" + (this.height instanceof HeightImpl ? ":" + this.height.adbg : "") +
            "-" + this.child.adbg;
      }
      // constructed with a child and a height.
      // the height represents not the height of the compressed parent tree, but
      // the height of "child"'s sibling (if any). In order to compress, child must have
      // same height as its sibling, so it is useful to track this. 
      constructor(
         readonly child: Node,
         readonly height: Height | "empty",
         readonly hasOpen: boolean
      ) {
         super();
      }
      // bind any v height to h in the entire tree (works down via recursion). 
      bindHeight(v: string, h: Height) {
         return new RootParent(
            this.child.bindHeight(v, h),
            this.height == "empty" ? "empty" : this.height.bind(v, h), this.hasOpen);
      }
      // same as bind height, except for axis. Only works from 
      // variable to variable. 
      bindAxis(from: string, to: string, flip: boolean): RootParent {
         return new RootParent(
            this.child.bindAxis(from, to, flip),
            this.height,
            this.hasOpen
         );
      }
      // can only be compressed if child can be compressed, child is not red,
      // and child has same height as sibling (if any).
      isCompressible() {
         if (!this.child.isCompressible() || this.child.color == "red")
            return false;
         else if (this.child.color == "unknown" && !this.hasOpen)
            return false;
         else if (this.height != "empty" && !this.child.height.equals(this.height))
            return false;
         else return true;
      }
      // compresses into a standalone tree.
      asCompressed(): [Root, Node[]] {
         return [JustTree, this.child.asCompressed()[1]];
      }
      setHeight(value: Height) {
         return new RootParent(this.child, value, this.hasOpen) as this;
      }
      // grab all used variables
      protected allUsed(vars: Set<string>) {
         if (this.height != "empty")
            this.height.allUsed(vars);
         this.child.allUsed(vars);
      }
      // fresh names used to allocate new variable names
      // during expansions/manipulations.
      private static freshName(vars: Set<string>, start: string, end: string) {
         let A = start.charCodeAt(0);
         let Z = end.charCodeAt(0);
         (A < Z).assert();
         let prefix = "";
         while (true) {
            for (let i = A; i <= Z; i += 1) {
               let name = prefix + String.fromCharCode(i);
               if (!vars.has(name))
                  return name;
            }
            {
               let last = prefix.length == 0 ? Z : prefix.last().charCodeAt(0);
               if (last < Z)
                  prefix = prefix.substring(0, prefix.length - 1) +
                     String.fromCharCode(last + 1);
               else prefix = prefix + String.fromCharCode(A);
            }
         }
      }
      freshNodeName(preferred: string[]): string[] {
         let vars = new Set<string>();
         this.allUsed(vars);
         let ret: string[] = [];
         for (let p of preferred) {
            let fresh = !vars.has(p) ? p : RootParent.freshName(vars, "A", "Z");
            ret.push(fresh);
            vars.add(fresh);
         }
         return ret;
      }
      // fresh variable names for heights and axes
      freshHeightName(preferred: string) {
         let vars = new Set<string>();
         this.allUsed(vars);
         if (!vars.has(preferred))
            return preferred;
         return RootParent.freshName(vars, "f", "n");
      }
      freshAxisName(preferred: string) {
         let vars = new Set<string>();
         this.allUsed(vars);
         if (!vars.has(preferred))
            return preferred;
         return RootParent.freshName(vars, "u", "z");
      }
   }
   // standalone tree, used as something
   // to describe a completely proper RB tree
   // without any exposed details.  
   class JustTree0 extends Root {
      get adbg() { return "T"; }
      isCompressible() { return false; }
      asCompressed(): [this, Node[]] { return [this, []]; }
      bindHeight() { return this; }
   }
   export const JustTree = new JustTree0();
   // the child of a node is either a node or a leaf.
   export type NodeChild = Node | Leaf;
   // abstract base class for node and leaf.
   export abstract class BaseNodeOrLeaf extends Image {
      abstract equals(other: NodeChild): boolean;
      // both nodes and leaves have heights, and unlike rootParent,
      // they main the actual height of the sub tree they represent. 
      abstract get height(): Height;
      // nodes are red or black, leafs are black or unknown.
      abstract get color(): "red" | "black" | "unknown";
   }
   // a core materialized tree element that isn't possibly Nil. 
   export class Node extends BaseNodeOrLeaf {
      get adbg() {
         let str = this.name + (this.color == "red" ? "#r" : "");
         if (this.left.equals(this.right))
            str += "[" + this.left.adbg + "]";
         else
            str += (this.axis != Axis.Plus ? this.axis.adbg : "") +
               "[left:" + this.left + ", right:" + this.right + "]";
         return str;
      }
      constructor(
         readonly name: string,
         readonly color: "red" | "black" | "unknown",
         readonly axis: Axis,
         readonly left: NodeChild,
         readonly right: NodeChild) {
         super();
      }
      // node height is the height of its leaves + 1 if the node is black.
      get height(): Height {
         let h = this.left.height;
         if (this.color == "black" || this.color == "unknown")
            return h.add(1);
         else return h;
      }
      canCompress(child: NodeChild) {
         if (!child.isCompressible())
            return false;
         else if (this.color == "red" && child.color != "black")
            return false;
         else if (
            this.color == "unknown" &&
            child.color != "black" &&
            !(child instanceof Leaf && child.hasOpen)
         )
            return false;
         else if (child instanceof Node && child.color == "unknown")
            return false;
         else return true;
      }


      isCompressible() {
         if (!this.canCompress(this.left) || !this.canCompress(this.right))
            return false;
         else if (!this.left.height.equals(this.right.height))
            return false;
         else return true;
      }
      // just turn the node into a leaf!
      asCompressed(): [Leaf, Node[]] {
         let left = this.left.asCompressed()[1];
         let right = this.right.asCompressed()[1];
         return [
            new Leaf(this.height, this.color == "black" ? "black" : "unknown", false),
            left.concat(right).concat([this])
         ];
      }
      equals(other: NodeChild): false { return false; }
      bindHeight(k: string, h: Height): Node {
         return new Node(
            this.name, this.color, this.axis,
            this.left.bindHeight(k, h),
            this.right.bindHeight(k, h));
      }
      bindAxis(from: string, to: string, flip: boolean): Node {
         let left = this.left.bindAxis(from, to, flip);
         let right = this.right.bindAxis(from, to, flip);
         let axis = this.axis;
         if (axis.varName == from) {
            axis = Axis.varAxis(to);
            if (flip)
               [left, right] = [right, left];
         }
         return new Node(this.name, this.color, axis, left, right);
      }
      allUsed(vars: Set<string>) {
         vars.add(this.name);
         this.axis.allUsed(vars);
         this.left.allUsed(vars);
         this.right.allUsed(vars);
      }
   }
   // a compressed subtree that is parented by a node, is empty
   // if black and a height of 1 (as per RB tree abstractions);
   export class Leaf extends BaseNodeOrLeaf implements HasExplicitHeight {
      get adbg() { return "lf" + this.height.adbg + (this.color == "black" ? "b" : ""); }
      constructor(
         readonly height: Height,
         readonly color: "black" | "unknown",
         readonly hasOpen: boolean
      ) {
         super();
         (!this.hasOpen || this.color == "unknown").assert();
      }
      // already compressed. 
      isCompressible() { return true; }
      asCompressed(): [this, Node[]] { return [this, []]; }

      equals(other: NodeChild) {
         if ((!(other instanceof Leaf)))
            return false;
         return this.height.equals(other.height) && this.color == other.color;
      }
      bindHeight(k: string, h: Height) {
         return new Leaf(this.height.bind(k, h), this.color, this.hasOpen);
      }
      bindAxis(from: string, to: string, flip: boolean): this { return this; }
      setHeight(value: Height) {
         return new Leaf(value, this.color, this.hasOpen) as this;
      }
      allUsed(vars: Set<string>) { this.height.allUsed(vars); }
   }
}

// a utility namespace for addresses, like the ones we used
// in rendering. Since tree elements do not store their parents 
// (and so can be shared), addresses store a path to the node
// for the context it is being used in. This namespace puts in
// the generic infrastructure for that. 
namespace ad {
   // an address element that supports getting an elem from a
   // parent or changing the elem in the parent. 
   export class AddrElem<T> extends Object {
      get adbg() { return this.name; }
      toString() { return this.adbg; }
      constructor(readonly name: string,
         readonly getFromParent: (e: T) => T,
         readonly setFromParent: (e: T, child: T) => T) {
         super();
      }
   }

   // an actual address.
   export class Address<T> extends Object {
      // cached length of address, usefor for comparisons.
      private readonly length: number;
      // element this address refers to.
      readonly image: T;
      // address has a previous and at to form a path like entity.
      constructor(readonly previous: Address<T>, readonly at: AddrElem<T>) {
         super();
         this.length = (this.previous ? this.previous.length : 0) + 1;
         this.image = this.at.getFromParent(this.previous ? this.previous.image : null);
      }
      get adbg(): string {
         return (this.previous ? this.previous.adbg + "." : "") + this.at.name;
      }
      toString() { return this.adbg; }
      // use factory method to create futher addresses, so we can upgrade
      // address if want to (and we will) by subclassing. 
      protected make(previous: Address<T>, at: AddrElem<T>) {
         return new Address<T>(previous, at);
      }
      // push on a new address element. 
      push(at: AddrElem<T>) { return this.make(this, at); }
      // address equality is deep. 
      equals(m: Address<T>): boolean {
         if (this.length != m.length)
            return false;
         let [a, b] = [this as Address<T>, m];
         while (true) {
            if (!a) {
               (!b).assert();
               return true;
            }
            if (a.at != b.at)
               return false;
            [a, b] = [a.previous, b.previous];
         }
      }
      // if this address is nested in another "m" address.
      // meaning "m" is a prefix of this.
      isNestedIn(m: Address<T>): boolean {
         let a = this as Address<T>;
         if (a.length < m.length)
            return false;
         (a.length >= m.length).assert();
         while (a.length > m.length)
            a = a.previous;
         return a.equals(m);
      }
      // replacement involves creating lots new elements all the way up to root
      // since elements are immutable. 
      replace(elem: T): Address<T> {
         if (this.previous == null) {
            let ret = (elem as any as RootT<T>).addr;
            (ret != null).assert();
            return ret;
         }
         // compute new parent element.
         let newParent = this.at.setFromParent(this.previous.image, elem);
         // replace parent element.
         let a = this.previous.replace(newParent);
         // make new address with same "at".
         let ret = this.make(a, this.at);
         (ret.image == elem).assert();
         return ret;
      }
   }

   // a root element stores its own address. 
   export interface RootT<T> {
      readonly addr: Address<T>;
   }
   // root address elements simply return the element, and without a parent,
   let seqRoot = 0;
   // don't support modification in a parent. 
   export function root<T>(at: T & RootT<T>): AddrElem<T> {
      let ret = new AddrElem<T>("root", () => at, () => { throw new Error() });
      (ret as any).index = seqRoot;
      seqRoot += 1;
      return ret;
   }
}

// make address more concrete for the needs of our domain elements. 
namespace dm {
   export type AddrElem = ad.AddrElem<Image>;
   // refined addres class, we won't expose this, preferring
   // type hackery via an Address interface instead. 
   class Address0 extends ad.Address<Image> {
      make(previous: Address, at: AddrElem): Address {
         (previous != null).assert();
         return new Address0(previous, at) as Address;
      }
      // simply replace for element, method renamed so 
      // it doesn't conflict with other replace methods defined in 
      // interfaces belove.  
      replaceE(image: Image): Address { return this.replace(image) as Address; }
      // root of a non-unified tree.
      get root(): Root {
         let a: Address = this as any as Address;
         while (a.previous)
            a = a.previous as Address;
         //(a.elem instanceof RootParent).assert();
         return a.image as Root;
      }
      // reset the root of a non-unified tree.
      // this method can only be used if the tree's topology has not changed.
      resetRoot(elem: RootParent): Address {
         if (this.previous == null)
            return elem.addr;
         let previous = (this.previous as Address).resetRoot(elem);
         return this.make(previous, this.at);
      }
      // child if elem is RootParent, else false.
      get child(): NodeAddress | false {
         if (this.image instanceof RootParent)
            return this.push(ChildAE) as NodeAddress;
         else return false;
      }
      // left child if elem is Node, else false.
      get left(): NodeAddress | LeafAddress | false {
         if (this.image instanceof Node)
            return this.push(LeftAE) as (NodeAddress | LeafAddress);
         else return false;
      }
      // right child if elem is Node, else false.
      get right(): NodeAddress | LeafAddress | false {
         if (this.image instanceof Node)
            return this.push(RightAE) as (NodeAddress | LeafAddress);
         else return false;
      }
      find(p: (addr: Address0) => boolean): Address0 | false {
         if (p(this))
            return this;
         else for (let c of this.image.children(this as any as Address)) {
            let ret = c.find(p);
            if (ret)
               return ret;
         }
         return false;
      }
      replaceRoot(root: Root): this {
         if (!this.previous)
            return root.addr as any as this;
         else {
            let previous = (this.previous as Address).replaceRoot(root);
            return this.make(previous, this.at) as any as this;
         }
      }
   }
   // Address interface, upgrades various types to be 
   // more expressive without requiring extra glue code.
   export interface Address extends Address0 {
      readonly previous: Address | null;
      // replace methods return an address appropriate of the element type. 
      replace(elem: RootParent): RootParentAddress;
      replace(elem: Leaf): LeafAddress;
      replace(elem: Node): NodeAddress;
      replace(elem: Leaf): LeafAddress;
      find(p: (addr: Address) => boolean): Address | false;
   }
   interface CompositeAddress extends Address {
      readonly root: RootParent;
   }


   export interface RootParentAddress extends CompositeAddress {
      // root parents have no parents themselves. 
      readonly previous: null;
      readonly image: RootParent;
      // discharge the false result from Address0, it will always return a node address.
      readonly child: NodeAddress;
      readonly left: false;
      readonly right: false;
   }
   export interface NodeAddress extends CompositeAddress {
      // nodes are parented by other nodes or a root parent. 
      readonly previous: NodeAddress | RootParentAddress;
      readonly image: Node;
      // discharge the false result from Address0
      readonly left: NodeAddress | LeafAddress;
      readonly right: NodeAddress | LeafAddress;
      readonly child: false;
   }
   export interface LeafAddress extends CompositeAddress {
      // leaves are always parented by nodes.
      readonly previous: NodeAddress;
      readonly image: Leaf;
      readonly child: false;
      readonly left: false;
      readonly right: false;
   }
   // root elements provide their own addresses since these will never change.
   export interface Root extends ad.RootT<Image> {
      readonly addr: Address;
   }
   export interface RootParent {
      readonly addr: RootParentAddress;
   }
   Object.defineProperty(Root.prototype, "addr", {
      get: function () {
         let self = this as Root & { addr0: Address; };
         if (!self.addr0)
            self.addr0 = new Address0(null, ad.root(self)) as Address;
         return self.addr0;
      },
      enumerable: true,
      configurable: true,
   })
   // address elements needed, are not exported.
   const ChildAE: AddrElem = new ad.AddrElem<Image>("child",
      (e: RootParent) => { return e.child; },
      (e: RootParent, child: Node) => {
         return new RootParent(child, e.height, e.hasOpen);
      }
   );
   const LeftAE: AddrElem = new ad.AddrElem<Image>("left",
      (e: Node) => { return e.left; },
      (e: Node, left: NodeChild) => {
         return new Node(e.name, e.color, e.axis, left, e.right);
      }
   );
   const RightAE: AddrElem = new ad.AddrElem<Image>("right",
      (e: Node) => { return e.right; },
      (e: Node, right: NodeChild) => {
         return new Node(e.name, e.color, e.axis, e.left, right);
      }
   );
   export interface Image {
      // use seek for when the topology has changed and 
      // we are too lazy to track precisely how a node's address
      // has changed (if any). This is O(N).
      seek(a: Address, name: string): NodeAddress | false;
      children(a: Address): (NodeAddress | LeafAddress)[];
   }
   Image.prototype.seek = function () { return false; }
   Image.prototype.children = function () { return []; }
   RootParent.prototype.seek = function (addr: RootParentAddress, name) {
      let self = this as RootParent;
      return self.child.seek(addr.child, name);
   }
   RootParent.prototype.children = function (a: RootParentAddress) {
      return [a.child];
   }
   Node.prototype.seek = function (addr: NodeAddress, name): NodeAddress | false {
      let self = this as Node;
      if (self.name == name)
         return addr as NodeAddress;
      let left = self.left.seek(addr.left, name);
      let right = self.right.seek(addr.right, name);
      return left ? left : right;
   }
   Node.prototype.children = function (a: NodeAddress) {
      return [a.left, a.right];
   }
}
// now we can start with the transmutations! Everything from now on until
// we do unification are methods to changing the tree via expansions, compressions,
// and mutations.

namespace dm {
   export interface HasExplicitHeight {
      // change an elem's concrete height into an abstract height via a 
      // height var v whose initial value is n.
      // addr will be used the address for each targetted element. 
      addHeightVar(addr: Address, v: string, n: number): false | (() => Address);
   }
   export interface RootParent extends HasExplicitHeight { }
   export interface Leaf extends HasExplicitHeight { }
   // is monkey patched into both RootParent and Leaf.
   function tryHeightVar(addr: Address, v: string, n: number): false | (() => Address) {
      let self = this as HasExplicitHeight;
      if (self.height == "empty")
         return false;
      let h = self.height.addAbstract(v, n);
      if (!h)
         return false;
      let h0 = h;
      return () => addr.replaceE(self.setHeight(h0));
   }
   RootParent.prototype.addHeightVar = tryHeightVar;
   Leaf.prototype.addHeightVar = tryHeightVar;
}


namespace dm {
   // manipulations for RootParent. 
   export interface RootParent {
      // try to compress this root parent into a unified tree.
      tryCompress(addr: RootParentAddress): (() => [Address, Node[]]) | false;
      // try to expand this root parent. P is the name of a new parent
      // node, G is the name of a new grandparent node, as needed.
      tryExpand(addr: RootParentAddress): ((P: string, G: string) => {
         readonly black: RootParentAddress,
         readonly red: RootParentAddress,
         readonly empty: RootParentAddress,
      }) | false;

      tryExpandHalf(addr: RootParentAddress): ((P: string) => {
         readonly notEmpty: RootParentAddress;
         readonly empty: RootParentAddress,
      }) | false;

      tryExpandHalf2(addr: RootParentAddress): ((G: string) => {
         readonly black: RootParentAddress;
         readonly red: RootParentAddress,
      }) | false;

   }

   RootParent.prototype.tryCompress = function (addr) {
      let self = this as RootParent;
      (addr.image == self).assert();
      if (!self.isCompressible())
         return false;
      return () => {
         let [a, b] = self.asCompressed();
         return [a.addr, b];
      }
   }
   RootParent.prototype.tryExpand = function (addr) {
      let self = this as RootParent;
      (addr.image == self).assert();
      // known empty root parents cannot be expanded
      // as their child node are the acutal roots. 
      if (self.height == "empty")
         return false;
      return (P, G) => {
         if (self.height == "empty")
            throw new Error();
         // construct 3 cases: black parent, red parent and black grand parent, 
         // and empty (no parent). 
         let bn = new Node(
            P,
            "black",
            Axis.Wild,
            self.child,
            new Leaf(self.height, "unknown", false)
         );
         let black = new RootParent(bn, self.height.add(1), false);

         let rrn = new Node(
            P,
            "red",
            Axis.Wild,
            self.child,
            new Leaf(self.height, "black", false)
         );
         let rbn = new Node(
            G,
            "black",
            Axis.Wild,
            rrn,
            new Leaf(self.height, "unknown", false)
         );
         let red = new RootParent(rbn, self.height.add(1), false);
         let empty = new RootParent(self.child, "empty", false);
         return {
            black: addr.replace(black),
            red: addr.replace(red),
            empty: addr.replace(empty),
         };
      }
      return false;
   }
   RootParent.prototype.tryExpandHalf = function (addr) {
      let self = this as RootParent;
      (addr.image == self).assert();
      // known empty root parents cannot be expanded
      // as their child node are the acutal roots. 
      if (self.height == "empty" || self.hasOpen)
         return false;
      return (P) => {
         if (self.height == "empty")
            throw new Error();
         // construct 3 cases: black parent, red parent and black grand parent, 
         // and empty (no parent). 
         let un = new Node(
            P,
            "unknown",
            Axis.Wild,
            self.child,
            new Leaf(self.height, "unknown", true)
         );
         let unknown = new RootParent(un, self.height.add(1), true);
         let empty = new RootParent(self.child, "empty", false);
         return {
            notEmpty: addr.replace(unknown),
            empty: addr.replace(empty),
         };
      }
      return false;
   }
   RootParent.prototype.tryExpandHalf2 = function (addr) {
      let self = this as RootParent;
      if (!self.hasOpen || self.child.color != "unknown" || self.height == "empty")
         return false;
      return (G) => {
         let n = self.child;
         let [bl, br] = [n.left, n.right];
         let [rl, rr] = [n.left, n.right];
         if (n.left instanceof Leaf && n.left.hasOpen) {
            bl = new Leaf(n.left.height, "unknown", false);
            rl = new Leaf(n.left.height, "black", false);
         }
         if (n.right instanceof Leaf && n.right.hasOpen) {
            br = new Leaf(n.right.height, "unknown", false);
            rr = new Leaf(n.right.height, "black", false);
         }
         let bn = new Node(n.name, "black", n.axis, bl, br);
         let black = new RootParent(bn, self.height, false);

         let rn = new Node(n.name, "red", n.axis, rl, rr);
         if (self.height == "empty")
            throw new Error();
         let gn = new Node(
            G,
            "black",
            Axis.Wild,
            rn,
            new Leaf(self.height.add(-1), "unknown", false)
         );
         let red = new RootParent(gn, self.height, false);
         return {
            red: red.addr,
            black: black.addr,
         }
      }
   }
}
namespace dm {
   export interface Leaf {
      // leaf can just be expanded, but has 
      // multiple cases depending if the node
      // is black or unknown. 
      tryExpand(addr: LeafAddress): false |
         ((C: string) => ({
            readonly tag: "unknown",
            readonly black: LeafAddress,
            readonly red: NodeAddress,
         } | {
            readonly tag: "black",
            readonly node: NodeAddress,
            // might not have an empty case. 
            readonly empty?: LeafAddress,
         }));
   }

   Leaf.prototype.tryExpand = function (addr) {
      let self = this as Leaf;
      if (self.color == "unknown") {
         if (self.hasOpen) {
            let n = addr.previous.image;
            if (n.color != "unknown")
               return false;
            if (!(addr.previous.previous.image instanceof RootParent))
               return false;
         }

         return (C) => {
            // if color is unknown, expands to either a black leaf
            // or a red node with two black leafs.
            let lfb = new Leaf(self.height, "black", false);
            let red = new Node(C, "red", Axis.Wild, lfb, lfb);
            let addr0 = addr;
            if (self.hasOpen) {
               let n = addr0.previous.image;
               let r = addr0.root;
               (n.color == "unknown" && r.hasOpen).assert();
               (addr0.previous.previous.image instanceof RootParent).assert();
               n = new Node(n.name, "black", n.axis, n.left, n.right);
               r = new RootParent(n, r.height, false);
               addr0 = addr0.replaceRoot(r);
            }
            return {
               tag: "unknown",
               black: addr.replace(lfb),
               red: addr0.replace(red),
            }
         }
      } if (self.height.equals(1)) // a black leaf with 1 height is already nil. 
         return false;
      return (C) => {
         // black child, its leafs are reduced by one. 
         let lfu = new Leaf(self.height.add(-1), "unknown", false);
         let node = new Node(C, "black", Axis.Wild, lfu, lfu);
         if (self.height.tag == "var" && self.height.varAdjust <= 0) {
            // might only be empty if (1) height has var and (2)
            // the var's adjustment is not a positive number.
            // otherwise, expression could be one already.
            let kv = -self.height.varAdjust + 1;
            (kv >= 1).assert();
            let newRoot = addr.root.bindHeight(
               self.height.varName,
               HeightImpl.concrete(kv)
            );
            // the empty case eliminates the variable from the entire tree
            // because it is bound with a concrete value.
            let empty = addr.resetRoot(newRoot) as LeafAddress;
            let e = empty.image;
            (e instanceof Leaf && e.height.equals(1) && e.color == "black").assert();
            return {
               tag: "black",
               node: addr.replace(node),
               empty: empty,
            }
         } else return {
            tag: "black",
            node: addr.replace(node),
         }
      }
   }
}

namespace dm {
   // node has the most manipulations. 
   export interface Node {
      // compress or not.
      tryCompress(addr: NodeAddress):
         false | (() => [LeafAddress | NodeAddress, Node[]]);
      // rotate node up to parent's location in a way that preserves
      // binary tree order.
      tryRotateUp(addr: NodeAddress):
         false | (() => NodeAddress);
      // determine how two different node axes are related. 
      tryCompareAxis(addr: NodeAddress, fromAddr: NodeAddress):
         false | ((v: string) => {
            // two cases, one is flipped, the other is not. 
            readonly unflipped: NodeAddress,
            readonly flipped: NodeAddress
         });
      // flip the axis on this node, adjust axis parameter accordingly.
      doFlipAxis(addr: NodeAddress): NodeAddress;
      // flip node color from red to black or vice versa.
      tryFlipColor(addr: NodeAddress):
         false | (() => [NodeAddress, (string | [string, string])]);
      tryDelete(addr: NodeAddress): false | (() => Address);
   }
   Node.prototype.tryCompress = function (addr):
      false | (() => [(LeafAddress | NodeAddress), Node[]]) {
      let self = this as Node;
      (addr.image == self).assert();
      // we only need to aadd a check to make sure
      // our parent isn't root, if so compressions
      // can't happen.. 
      if (addr.previous.image instanceof RootParent) {
         // we might be able to "promote" a left or right node.
         if (self.color == "red")
            return false;
         let parent = addr.previous.image;
         let [a, b] = self.left instanceof Node ? [self.left, self.right] : [self.right, self.left];
         if (!(a instanceof Node) || !(b instanceof Leaf) || !self.canCompress(b))
            return false;
         if (parent.height != "empty" && !parent.height.equals(b.height.add(1)))
            return false;
         return () => {
            if (!(a instanceof Node) || !(b instanceof Leaf))
               throw new Error();
            if (self.color == "black" && a.color == "red") {
               let na = new Node(a.name, "unknown", a.axis, a.left, a.right);
               return [new RootParent(na, b.height.add(1), true).addr.child, [self]];
            } else return [new RootParent(a, b.height, false).addr.child, [self]];
         }
      }
      (addr.previous.image instanceof Node).assert();
      if (!self.isCompressible())
         return false;
      return () => {
         let [a, b] = self.asCompressed();
         return [addr.replace(a), b];
      }
   }

   Node.prototype.tryRotateUp = function (addr) {
      let self = this as Node;
      // rotation is only possible if parent is a node.
      if (addr.previous.image instanceof RootParent)
         return false;
      if (!(addr.previous.image instanceof Node))
         throw new Error();
      let parent = addr.previous.image;
      // check if relationship between axes is known.  
      // this node's axis is only relavant if
      // its children are not equal.
      if (!self.left.equals(self.right)) {
         if (parent.axis == Axis.Wild || self.axis == Axis.Wild)
            return false;
         // if either parent or this node's axis is var,
         // they must be the same var. 
         else if (parent.axis.isVar() || self.axis.isVar())
            if (!parent.axis.equals(self.axis))
               return false;
      }
      let self0 = self;
      let parent0 = parent;
      return () => {
         let a1 = addr as NodeAddress & { readonly previous: NodeAddress };
         let self = self0;
         let parent = parent0;
         // keep track if we are left or right child of parent. 
         if (!self.left.equals(self.right) && !self.axis.equals(parent.axis)) {
            // flip the node's children if necessary to match parent's axis parameter.
            (self.axis == Axis.Plus || self.axis == Axis.Minus).assert();
            addr = addr.replace(
               new Node(self.name, self.color,
                  this.axis == Axis.Plus ? Axis.Minus : Axis.Plus, self.right, self.left));
            self = addr.image as Node;
            parent = addr.previous.image as Node;
         }
         (self.axis.equals(parent.axis) || self.left.equals(self.right)).assert();
         // rotate according to whether left or rich child, 
         // ignoring what the concrete topology of the two nodes
         // are because we know they are the same (or it doesn't matter).
         if (parent.left == self) {
            // better to draw pictures than talk about what is going on. 
            // rotation is a just a specific new topology. 
            let [ax, bx, cx] = [self.left, self.right, parent.right];
            let newParent = new Node(parent.name, parent.color, parent.axis, bx, cx);
            let newNode = new Node(self.name, self.color, parent.axis, ax, newParent);
            return addr.previous.replace(newNode);
         } else {
            (parent.right == self).assert();
            let [ax, bx, cx] = [parent.left, self.left, self.right];
            let newParent = new Node(parent.name, parent.color, parent.axis, ax, bx);
            let newNode = new Node(self.name, self.color, parent.axis, newParent, cx);
            return addr.previous.replace(newNode);
         }
      }
   }


   Node.prototype.tryCompareAxis = function (addr, fromAddr) {
      let self = this as Node;
      (addr.image == self).assert();
      // no point to compare axis if left or right children are equal
      if (self.left.equals(self.right))
         return false;
      (!fromAddr.image.left.equals(fromAddr.image.right)).assert();
      (fromAddr.image instanceof Node).assert();
      (fromAddr.image.axis == Axis.Wild || fromAddr.image.axis.isVar()).assert();
      if (fromAddr.image.axis.isVar() && self.axis.isVar()) {
         // if they are both vars, one var will be replaced by the other. 
         let from = self.axis.varName;
         let to = fromAddr.image.axis.varName;
         if (from == to)
            return false;
         return () => {
            let root = addr.root;
            // first case, from variable changes to to variable, but left/right stays the same.
            let unflip = root.bindAxis(from, to, false);
            // like first, but all references to from axis have flipped left/right children.
            let flip = root.bindAxis(from, to, true);
            // because the topology of the tree could have changed
            // above us, we must use seek to find where the node has gone.
            let flipA = flip.seek(flip.addr, self.name);
            if (!flipA)
               throw new Error();
            (flipA.image instanceof Node && flipA.image.name == self.name).assert();
            return { unflipped: addr.resetRoot(unflip) as NodeAddress, flipped: flipA };
         }
         // otherwise, the targetted axis must be wild (unknown and not a var)
      } else if (self.axis != Axis.Wild)
         return false;
      // fromAddr must be a var or a wild

      return (v) => {
         let newA = addr;
         if (fromAddr.image.axis.isVar()) {
            // we don't have to rewrite other.
         } else {
            (fromAddr.image.axis == Axis.Wild).assert();
            let fn = fromAddr.image;
            // add variable to from node first. 
            fn = new Node(fn.name, fn.color, Axis.varAxis(v), fn.left, fn.right);
            fromAddr = fromAddr.replace(fn);
            // since topology didn't change, we can simply impose
            // new root on addr and get back "self".
            addr = addr.resetRoot(fromAddr.root) as NodeAddress;
            (addr.image.name == self.name).assert();
            self = addr.image;
         }
         let fn = fromAddr.image;
         // compute two cases together using from node axis.
         let unflip = new Node(self.name, self.color, fn.axis, self.left, self.right);
         let flip = new Node(self.name, self.color, fn.axis, self.right, self.left);
         return {
            unflipped: addr.replace(unflip),
            flipped: addr.replace(flip),
         }
      }
   }
   Node.prototype.doFlipAxis = function (addr) {
      // swap axis of node so its left and right children
      // reverse. 
      let self = this as Node;
      if (!self.axis.isVar()) {
         let axis = self.axis;
         if (axis == Axis.Plus)
            axis = Axis.Minus;
         else if (axis == Axis.Minus)
            axis = Axis.Plus;
         // easy case, + => -, - => +, * => *
         return addr.replace(new Node(
            self.name, self.color, axis, self.right, self.left
         ));
      } else {
         // is a variable so we have to swap every 
         // node's children who use that variable to
         // describe their axis. 
         let v = self.axis.varName;
         let root = addr.root.bindAxis(v, v, true);
         // since the topology could have been messed up,
         // use seek to brute force the current node's new address.
         let na = root.seek(root.addr, self.name);
         if (!na)
            throw new Error();
         else return na;
      }
   }
   Node.prototype.tryFlipColor = function (addr):
      false | (() => [NodeAddress, (string | [string, string])]) {
      let self = this as Node;
      if (self.color == "unknown")
         return false;
      if (addr.previous.image instanceof RootParent &&
         addr.previous.image.hasOpen) {
         // swap color. 
         return () => {
            let naddr = addr.find(
               a => a.image instanceof Node && a.image.color == "unknown"
            ) as NodeAddress;
            // give it my color
            naddr = naddr.replace(new Node(
               naddr.image.name,
               self.color,
               naddr.image.axis,
               naddr.image.left,
               naddr.image.right
            ));
            addr = naddr.root.addr.child;
            (addr.image.name == self.name).assert();
            self = addr.image;
            return [addr.replace(new Node(
               self.name,
               "unknown",
               self.axis,
               self.left,
               self.right
            )), [self.name, naddr.image.name]];
         }
      }
      return () => {
         (addr.image == self).assert();
         return [addr.replace(new Node(
            self.name,
            self.color == "red" ? "black" : "red",
            self.axis,
            self.left,
            self.right
         )), self.name];
      };
   }

   Node.prototype.tryDelete = function (addr) {
      let self = this as Node;
      let promote: Node | Leaf;
      if (self.color == "unknown")
         return false;
      else if (self.left.color == "black" && self.left.height.concrete == 1)
         promote = self.right;
      else if (self.right.color == "black" && self.right.height.concrete == 1)
         promote = self.left;
      else return false;
      if (addr.previous.image instanceof RootParent && promote instanceof Leaf) {
         let r = addr.previous.image;
         if (r.height != "empty")
            return false;
         return () => JustTree.addr;
      }
      if (addr.previous.image instanceof RootParent && !(promote instanceof Node))
         return false;
      // promote.
      return () => addr.replaceE(promote) as (NodeAddress | LeafAddress);
   }
}

// hashing images and determining if they are compatible,
// used to find targets for goto (hash to find candidates, unify
// to see if any actually match).
namespace dm {
   export interface HeightImpl {
      unify(into: Height, txt: {
         readonly hS: Map<string, Height>
      }): false | (() => void);
   }
   export interface Axis {
      unify(into: Axis, txt: {
         readonly aS: Map<string, Axis>
      }): false | (() => void);
   }
   // height unification will bind into height 
   // if var. 
   HeightImpl.prototype.unify = function (into, txt): false | (() => void) {
      let self = this as Height;
      if (into.tag == "concrete") // if not var, must be equal.
         return !self.equals(into) ? false : () => { };
      if (self.tag == "concrete" && self.concrete <= into.varAdjust)
         return false;
      // if into is k + 2 and self is h + 1, 
      // then solve k + 2 = h + 1 for k,
      // giving us k = h - 1;

      self = self.add(-into.varAdjust);
      if (txt.hS.has(into.varName))
         return self.equals(txt.hS.get(into.varName)) ? () => { } : false;
      txt.hS.set(into.varName, self);
      return () => txt.hS.delete(into.varName);
   }
   Axis.prototype.unify = function (into, txt): false | (() => void) {
      let self = this as Axis;
      if (into == Axis.Wild)
         return () => { };
      else if (self == Axis.Wild)
         return false;
      else if (!into.isVar())
         return self.equals(into) ? () => { } : false;
      if (txt.aS.has(into.varName))
         return txt.aS.get(into.varName).equals(self) ? () => { } : false;
      txt.aS.set(into.varName, self);
      return () => txt.aS.delete(into.varName);
   }



   export class Unify {
      readonly hS = new Map<string, Height>();
      readonly aS = new Map<string, Axis>();
      readonly nS = new Map<string, string>();
      readonly flipColors = new Array<string>();
      readonly flipAxes = new Array<string>();
      get adbg() {
         return "[" +
            this.hS.mapi(([a, b]) => a + " = " + b).concati(
               this.aS.mapi(([a, b]) => a + " = " + b)
            ).concati(
               this.nS.mapi(([a, b]) => a + " = " + b)
            ).concati(
               this.flipColors.map(a => "flipC(" + a + ")")
            ).concati(
               this.flipAxes.map(a => "flipA(" + a + ")")
            ).format() + "]";
      }
   }
   export interface Image {
      readonly hash: string;
      checkUnify(into: Image): Unify | false;
      unify(into: Image, txt: Unify): false | (() => void);
   }
   Image.prototype.checkUnify = function (into) {
      let self = this as Image;
      let txt = new Unify();
      return self.unify(into, txt) ? txt : false;
   }
   RootParent.prototype.unify = function (into, txt) {
      let self = this as RootParent;
      if (!(into instanceof RootParent))
         return false;

      if (self.hasOpen && !into.hasOpen)
         return false;
      // since a root parent of "k" height can
      // expand to empty, we can pass through
      // empty from roots (but not empty into roots). 
      if (self.height == "empty") { }
      else if (into.height == "empty")
         return false;
      else if (!self.height.unify(into.height, txt))
         return false;
      return self.child.unify(into.child, txt);
   }
   JustTree.unify = function (into) {
      return into == JustTree ? () => { } : false;
   }
   Node.prototype.unify = function (into, txt) {
      // everything must unify. 
      let self = this as Node;
      if (!(into instanceof Node))
         return false;
      else if ((self.color == "unknown") != (into.color == "unknown"))
         return false;
      let flipped = false;
      let left0 = self.left.unify(into.left, txt);
      let right0 = left0 ? self.right.unify(into.right, txt) : false;
      if (self.axis == dm.Axis.Wild && (!left0 || !right0)) {
         right0 ? right0() : left0 ? left0() : {};
         left0 = self.right.unify(into.left, txt);
         right0 = left0 ? self.left.unify(into.right, txt) : false;
         flipped = true;
      }
      let axis0 = (!left0 || !right0) ? false :
         self.left.equals(self.right) ? () => { } :
            self.axis.unify(into.axis, txt);
      if (!left0 || !right0 || !axis0) {
         left0 ? left0() : {};
         right0 ? right0() : {};
         axis0 ? axis0() : {};
         return false;
      }
      txt.nS.set(into.name, self.name);
      if (into.color != "unknown" && self.color != into.color) {
         txt.flipColors.push(self.name);
      }
      if (flipped)
         txt.flipAxes.push(self.name);
      let [left, right, axis] = [left0, right0, axis0];
      return () => {
         txt.nS.delete(into.name);
         let idx = txt.flipColors.indexOf(self.name);
         if (idx >= 0)
            txt.flipColors.splice(idx, 1);
         idx = txt.flipAxes.indexOf(self.name);
         if (idx >= 0)
            txt.flipAxes.splice(idx, 1);
         axis(); right(); left();
      }
   }
   Leaf.prototype.unify = function (into, txt) {
      let self = this as Leaf;
      if (!(into instanceof Leaf))
         return false;
      // only check self color if into color is black,
      // otherwise into is unknown which can match both
      // black and unkown. 
      else if (self.color == "unknown" && into.color != "unknown")
         return false;
      else if (self.hasOpen && !into.hasOpen)
         return false;
      return self.height.unify(into.height, txt);
   }
   Object.defineProperty(RootParent.prototype, "hash", {
      get: function () {
         let self = this as RootParent;
         // scrub out height since unification
         // doesn't rely on equal heights. 
         // normalize axis. 
         return "R:" + self.child.hash;
      }, enumerable: true, configurable: true,
   })
   Object.defineProperty(JustTree, "hash", {
      get: function () { return "T"; }
   })
   Object.defineProperty(Node.prototype, "hash", {
      get: function () {
         let self = this as Node;
         let left = self.left.hash;
         let right = self.right.hash;
         if (left.localeCompare(right) > 0)
            [left, right] = [right, left];
         return "N[l:" + left + "][" + right + "]";
      }, enumerable: true, configurable: true,
   })
   Object.defineProperty(Leaf.prototype, "hash", {
      get: function () {
         let self = this as Leaf;
         // again, scrub out height
         return "LF";
      }, enumerable: true, configurable: true,
   })
}

namespace dmtest {
   export function test() {
      let empty = new dm.Leaf(dm.HeightImpl.usingVar("k", 0), "black", false);
      { // check rotate.
         let N = new dm.Node("N", "red", dm.Axis.Wild, empty, empty);
         let P = new dm.Node("P", "black", dm.Axis.Wild, N, empty);
         let R = new dm.RootParent(P, dm.HeightImpl.usingVar("k", 1), false);
         let Paddr = R.addr.child;
         let Naddr = Paddr.left as dm.NodeAddress;
         console.log(Naddr.root.adbg);
         {
            let f = R.tryCompress(R.addr);
            if (!f)
               throw new Error();
            let Raddr = f()[0];
            console.log(Raddr.image.adbg);
         }
         {
            let f = N.tryCompress(Naddr);
            if (!f)
               throw new Error();
            let Naddr0 = f()[0];
            console.log(Naddr0.root.adbg);
         }
         {
            let f = N.tryCompareAxis(Naddr, Paddr);
            if (f)
               throw new Error();
            let g = N.tryRotateUp(Naddr);
            if (!g)
               throw new Error();
            let Naddr0 = g();
            console.log(Naddr0.root.adbg);
         }

         let f = N.tryFlipColor(Naddr);
         if (!f)
            throw new Error();
         console.log(f()[0].root.adbg);
         {
            let f = R.tryExpand(R.addr);
            if (!f)
               throw new Error();
            let ret = f("G", "Q");
            console.log(ret.black.image.adbg);
            console.log(ret.red.image.adbg);
            console.log(ret.empty.image.adbg);

            let f0 = ret.black.image.tryCompress(ret.black);
            let f1 = ret.black.image.tryCompress(ret.black);
            let f2 = ret.black.image.tryCompress(ret.black);
            if (!f0 || !f1 || !f2)
               throw new Error();
            console.log(f0()[0].image.adbg);
            console.log(f1()[0].image.adbg);
            console.log(f2()[0].image.adbg);
            true.assert();

         }
      }
      console.log("XXXXXXXX");
      {
         let N = new dm.Node("N", "red", dm.Axis.Wild, empty, empty);
         let R = new dm.RootParent(N, empty.height, false);
         console.log(R.adbg);

         let f0 = R.tryExpand(R.addr);
         if (f0) {
            let expand = f0("P", "G");
            console.log(expand.empty.image.adbg);
            console.log(expand.black.image.adbg);
            console.log(expand.red.image.adbg);
            console.log("uncle");
            let Uaddr = expand.red.child.right as dm.LeafAddress;

            let f1 = Uaddr.image.tryExpand(Uaddr);
            if (f1) {
               let expand = f1("U");
               if (expand.tag != "unknown")
                  throw new Error();
               console.log(expand.black.root.adbg);
               console.log(expand.red.root.adbg);

               let G = expand.black.root.addr.child;
               let P = G.left as dm.NodeAddress;
               let N = P.left as dm.NodeAddress;
               console.log("compare");
               let f0 = P.image.tryCompareAxis(P, G);
               if (f0) {
                  let compared = f0("𝛼");
                  console.log(compared.unflipped.root.adbg);
                  console.log(compared.flipped.root.adbg);
                  console.log("rotate");
                  let G = compared.flipped.root.addr.child;
                  let P = G.left as dm.NodeAddress;
                  let N = P.right as dm.NodeAddress;
                  let f1 = N.image.tryRotateUp(N);
                  if (f1) {
                     let N = f1();
                     console.log(N.root.adbg);
                     let f0 = N.image.tryRotateUp(N);
                     if (!f0)
                        throw new Error();
                     N = f0();
                     {
                        let f9 = N.image.tryFlipColor(N);
                        if (!f9)
                           throw new Error();
                        N = f9()[0];
                     }
                     let G = N.right as dm.NodeAddress;
                     {
                        let f9 = G.image.tryFlipColor(G);
                        if (!f9)
                           throw new Error();
                        G = f9()[0];
                     }
                     console.log(G.root.adbg);
                     console.log("compress");
                     let R = G.root.addr;
                     let f = R.image.tryCompress(R);
                     if (!f)
                        throw new Error();
                     let T = f()[0];
                     console.log(T.image.adbg);
                  } else throw new Error();
               } else throw new Error();
            } else throw new Error();
         } else throw new Error();
      }
   }
}