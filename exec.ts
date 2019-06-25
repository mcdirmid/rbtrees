namespace ebl {
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
      readonly subLines: Line[];
      readonly next: Line;
      readonly previous: Line;
      equals(other: Line): boolean;
      isNestedIn(other: Line): boolean;
      readonly tag: "instruction";
   }
   export interface Switch extends bbl.Instruction, BaseLine {
      readonly self: Instruction;
      readonly parent: Block;
      readonly subLines: Line[];
      readonly next: Line;
      readonly previous: Line;
      equals(other: Line): boolean;
      isNestedIn(other: Line): boolean;
      readonly tag: "instruction";
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
      readonly footer: Footer;
      readonly tag: "header";
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
      // readonly footer : Footer;
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
      readonly owner: Proc | Switch;
      readonly tag: "footer";
   }
   export interface Block extends bbl.Block {
      readonly instructions: Instruction[];
      readonly owner: Proc | Case;
   }
   export interface BlockProvider extends bbl.BlockProvider {
      makeBlock(header: Header): Block;
   }
   export type Line = Instruction | Header | Footer;
}

namespace ebl {
   type State = dm.Root;
   type Unify = dm.Unify;
   export interface BaseLine {
      readonly isPassThroughState?: boolean;
      readonly state: State;
      readonly toks: tks.Toks;
   }


   // remember and retrieve images and date by hash/unify. 
   class HashUnify {
      private readonly map = new Map<string, Set<Line>>();

      add(value: Line) {
         if (value.isPassThroughState)
            return;
         let state = value.state;
         if (!state)
            return;
         let map0 = this.map.getOrSet(state.hash, () => new Set<Line>());
         (!map0.has(value)).assert();
         map0.add(value);
      }
      delete(value: Line): void {
         if (value.isPassThroughState)
            return;
         let state = value.state;
         if (!state)
            return;
         this.map.get(state.hash).delete(value).assert();
      }
      lookup(state: State): [Unify, Line][] {
         let ret: [Unify, Line][] = [];
         let map0 = this.map.get(state.hash);
         if (map0)
            for (let value of map0) {
               let into = value.state;
               if (into == state)
                  continue;
               let result = state.checkUnify(into) as Unify;
               if (!result)
                  continue;
               ret.push([result, value]);
            }
         return ret;
      }
   }
   export abstract class Footer extends bbl.Footer {
      abstract get toks(): tks.Toks;
      abstract get state(): State;
   }
   class ProcFooter extends Footer {
      constructor(readonly owner: Proc) {
         super();
      }
      get toks(): tks.Toks { return [["endproc", tks.KW]]; }
      get state() { return this.owner.returnState; }
   }
   export interface Return extends Instruction {
      // readonly isPassThroughState: true;
   }

   export type Profile = {
      root: exe.Node,
      starting: Instruction | Header,
      args: [string, number | [exe.Node, boolean]][],
      result?: ExeResult,
   }
   export type ExeResult = [exe.Context, Line[], "error" | "return"];


   export abstract class Proc extends bbl.Proc implements Header {
      readonly states = new HashUnify();
      readonly gotos = new Map<Line, [number, Set<Goto>]>();
      private readonly labels = new Array<Line>();

      private readonly returns = new Set<Return>();

      register(line: Line) {
         super.register(line);
         this.states.add(line);
         if (line instanceof Goto) {
            let info = this.gotos.getOrSet(line.target, (target) => {
               this.labels.push(target);
               return [this.labels.length - 1, new Set<Goto>()];
            });
            info[1].add(line);
         } else if (line instanceof Return) {
            this.returns.tryAdd(line).assert();
            if (!this.returnState)
               this.returnState = line.state;
            else {
               let unify = line.state.checkUnify(this.returnState);
               if (!unify) {
                  unify = this.returnState.checkUnify(line.state);
                  if (!unify)
                     throw new Error();
                  this.returnState = line.state;
               } else { }
            }
         }

      }
      unregister(line: Line) {
         super.unregister(line);
         this.states.delete(line);
         if (line instanceof Goto) {
            let info = this.gotos.get(line.target);
            info[1].delete(line).assert();
            if (info[1].isEmpty()) {
               this.labels.splice(info[0], 1);
               for (let i = 0; i < this.labels.length; i += 1)
                  this.gotos.get(this.labels[i])[0] = i;
            }
         } else if (line instanceof Return) {
            this.returns.delete(line).assert();
            if (this.returns.isEmpty())
               this.returnState = null;
         }
      }
      labelFor(line: Line): string | false {
         if (!this.gotos.has(line))
            return false;
         let idx = this.gotos.get(line)[0];
         return "L" + idx;
      }
      lookup(state: State) { return this.states.lookup(state); }

      readonly footer: ProcFooter;
      constructor(provider: BlockProvider, readonly name: string, readonly args: string[], readonly state: State) {
         super(provider);
         this.footer = new ProcFooter(this);
         this.register(this);
      }
      profile: Profile;
      makeArgs: (proc: this, root: exe.Node, r: Random) => [string, number][] = null;
      makeProfile(line: Line): false | ((r: Random) => Profile) {
         if (line instanceof Goto || line instanceof Return || line instanceof Footer || line instanceof Switch || !line.state)
            return false;
         if (this.makeArgs == null)
            return false;
         return (r) => {
            let binding = new Map<string, boolean | number | [exe.Node, boolean]>();
            let root = line.state.generate(r, binding, 0, 1000);
            let nodes = binding.filteri(([a, b]) => b instanceof Array).toArray() as [string, [exe.Node, boolean]][];
            return {
               starting: line,
               root: root,
               args: (this.makeArgs(this, root, r) as [string, number | [exe.Node, boolean]][]).concat(nodes),
            };
         };
      }

      //makeProfile: () => Profile;


      //readonly profiles: Profile[] = [];
      exec(profile: Profile): void {
         let executed = new Array<Line>();
         let txt = new exe.Context();
         (txt.version == 0).assert();
         if (profile.root)
            profile.root.clear();
         else
            true.assert();
         txt.root.set(0, profile.root);
         for (let [a, b] of profile.args) {
            if (typeof b == "number")
               txt.remember(a, b);
            else txt.remember(a, b[0], b[1]);
         }
         txt.increment();
         executed.push(profile.starting);
         // figure out next.
         let at: Instruction;
         {
            let at0: Line = profile.starting;
            if (at0 instanceof Switch || at0 instanceof Goto || at0 instanceof Return)
               throw new Error();
            while (true) {
               if (at0 == null) {
                  profile.result = [txt, executed, "error"];
                  return;
               }
               at0 = at0.next;
               if (at0 instanceof Instruction) {
                  at = at0;
                  break;
               }
            }
         }
         while (true) {
            (executed.length == txt.version).assert();
            executed.push(at);
            let result = at.exec(txt);
            if (result instanceof Case) {
               executed[executed.length - 1] = result;
               if (result.block.instructions.length > 0) {
                  txt.increment();
                  at = result.block.instructions.first();
                  continue;
               } else {
                  profile.result = [txt, executed, "error"];
                  return;
               }
            } else if (result instanceof Instruction) {
               txt.increment();
               at = result;
               continue;
            } else if (typeof result == "string") {
               profile.result = [txt, executed, result];
               return;
            } else {
               let r = result instanceof exe.Node ? result : null;
               txt.increment(r);
               if (at.index == at.parent.instructions.length - 1) {
                  profile.result = [txt, executed, "error"];
                  return;
               }
               at = at.parent.instructions[at.index + 1];
               continue;
            }


         }

      }
      update(): Profile {
         let profile = this.profile;
         if (!profile || profile.result)
            return profile;
         this.exec(profile);
         (profile.result != null).assert();
         return profile;
      }
      invalidate(block: Block) {
         super.invalidate(block);
         if (this.profile) {
            delete this.profile.result;
         }
      }


      get adbg() { return "proc " + this.name; }
      get toks(): tks.Toks {
         let ret: tks.Toks = [["proc ", tks.KW]];
         ret.push(...tks.toToks(this.name));
         ret.push(...tks.mkList(this.args));
         return applyLabel(this, ret);
      }
      returnState: State;
   }
}
namespace exe {
   export type Version = number;
   class Cell<T> {
      private readonly values = new Array<T>();
      private readonly versions = new Array<Version>();
      private index = 0;
      private seek(v: Version) {
         if (this.versions.length == 0)
            return undefined;
         let i = this.index;
         while (i < this.versions.length - 1 && this.versions[i + 1] <= v)
            i += 1;
         while (i > 0 && this.versions[i] > v)
            i -= 1;
         if (this.versions[i] > v) {
            (i == 0).assert();
            return undefined;
         }
         (i == this.versions.length - 1 || this.versions[i + 1] > v).assert();
         this.index = i;
         return i;
      }
      clear() {
         while (this.versions.length > 0 && this.versions.last() != 0) {
            this.versions.pop();
            this.values.pop();
         }
      }
      allValues(): Iterable<T> { return this.values; }

      get(v: Version) {
         let i = this.seek(v);
         return i == undefined ? undefined : this.values[i];
      }
      set(v: Version, value: T) {
         if (this.values.length > 0) {
            (this.versions.last() < v).assert();
            let last = this.values.last();
            if (last == value)
               return;
         }
         this.versions.push(v);
         this.values.push(value);
      }
   }
   export type Dir = "left" | "right" | "root";
   export type Color = "red" | "black";

   export interface BNode {
      value: number;
      color?: Color;
      left?: BNode | Node;
      right?: BNode | Node;
   }

   export class Node extends Object {
      clear() {
         for (let child of this.left.allValues().concati(this.right.allValues()))
            if (child != null)
               child.clear();
         this.color.clear();
         this.left.clear();
         this.right.clear();
         this.parent.clear();
         this.value.clear();
      }
      readonly color = new Cell<Color>();
      readonly left = new Cell<Node>();
      readonly right = new Cell<Node>();
      readonly parent = new Cell<Node>();
      readonly value = new Cell<number>();

      static make(node: BNode) {
         let ret = new Node();
         ret.init(node);
         return ret;
      }

      private init(node: BNode) {
         this.value.set(0, node.value);
         this.color.set(0, node.color ? node.color : "black");

         if (node.left) {
            let child: Node;
            if (node.left instanceof Node)
               child = node.left;
            else {
               child = new Node();
               child.init(node.left);
            }
            this.left.set(0, child);
            child.parent.set(0, this);
         }
         if (node.right) {
            let child: Node;
            if (node.right instanceof Node)
               child = node.right;
            else {
               child = new Node();
               child.init(node.right);
            }
            this.right.set(0, child);
            child.parent.set(0, this);
         }
      }

      toStringV(v: Version): string {
         let clr = this.color.get(v);
         let value = this.value.get(v);
         let left = this.left.get(v);
         let right = this.right.get(v);
         return value + (clr == "red" ? "R" : "") + "[" + (left ? left.toStringV(v) : "nil") + ", " + (right ? right.toStringV(v) : "nil") + "]";
      }
      values(v: Version, set: Set<number>) {
         set.add(this.value.get(v));
         let left = this.left.get(v);
         let right = this.right.get(v);
         if (left)
            left.values(v, set);
         if (right)
            right.values(v, set);
      }
      dir(v: Version): Dir {
         let p = this.parent.get(v);
         if (p == undefined)
            return "root";
         else if (p.left.get(v) == this)
            return "left";
         else {
            (p.right.get(v) == this).assert();
            return "right";
         }



      }



      get(v: Version, dir: Dir) {
         (dir != "root").assert();
         return (dir == "left" ? this.left : this.right).get(v);
      }
      set(v: Version, dir: Dir, node: Node) {
         (dir != "root").assert();
         let cell = dir == "left" ? this.left : this.right;
         cell.set(v, node);
         if (node != null)
            node.parent.set(v, this);
      }
      rotateUp(v: Version): void | Node {
         console.debug("ROTATE!");
         let p = this.parent.get(v);
         let n = this;
         let dir = this.dir(v);
         (dir != "root").assert();
         let pdir = p.dir(v);
         let g = pdir == "root" ? undefined : p.parent.get(v);

         let odir: Dir = dir == "left" ? "right" : "left";
         let b = n.get(v, odir);
         p.set(v, dir, b);
         n.set(v, odir, p);
         if (pdir != "root")
            g.set(v, pdir, n);
         else {
            n.parent.set(v, null);
            return n;
         }
      }
      delete(v: Version): void | Node {
         let [left, right] = [this.left.get(v), this.right.get(v)];
         let promote = left == undefined ? right : left;
         let dir = this.dir(v);
         if (dir != "root") {
            let parent = this.parent.get(v);
            parent.set(v, dir, promote);
         } else return promote;
      }
      swapToLeaf(v: Version) {
         let [left, right] = [this.left.get(v), this.right.get(v)];
         if (left == undefined || right == undefined)
            return this;
         let to = right;
         while (true) {
            let left = to.left.get(v);
            if (!left)
               break;
            else to = left;
         }
         // swap at and this
         let fromValue = this.value.get(v);
         let toValue = to.value.get(v);
         (toValue > fromValue).assert();
         this.value.set(v, toValue);
         to.value.set(v, fromValue);
         return to;

      }
      seek(v: Version, value: number): Node | [Node, Dir] {
         let at: Node = this;
         while (true) {
            let delta = value - at.value.get(v);
            if (delta == 0)
               return at;
            let dir: Dir = delta < 0 ? "left" : "right";
            let next = at.get(v, dir);
            if (next == undefined)
               return [at, dir];
            else at = next;
         }
      }
      insertBin(v: Version, node: Node) {
         let result = this.seek(v, node.value.get(v));
         if (result instanceof Node)
            throw new Error();
         result[0].set(v, result[1], node);
      }
   }
   export class Context extends Object {
      readonly map = new Map<string, Cell<number | Node>>();
      version: Version = 0;
      readonly root = new Cell<Node>();
      private readonly flipped = new Map<string, Cell<boolean>>();
      constructor() {
         super();
      }
      private get(N: string) {
         return (this.map.get(N).get(this.version) as Node);
      }
      reverse(version: Version, rmap: Map<exe.Node, [string, boolean]>) {
         for (let [a, b] of this.map) {
            let node = b.get(version);
            if (node instanceof Node) {
               let f = this.flipped.get(a);
               let f0 = f ? f.get(version) : false;
               rmap.set(node, [a, f0 ? true : false]);
            }
         }
      }
      increment(r?: (Node | void)) {
         let r0 = r instanceof Node ? r : this.root.get(this.version);
         if (r0)
            while (true) {
               let p = r0.parent.get(this.version);
               if (!p)
                  break;
               else r0 = p;
            }
         if (this.version > 0)
            this.root.set(this.version, r0);
         this.version += 1;
      }
      forget(Ns: string[]) {
         for (let N of Ns) {
            let node = this.get(N);
            (node instanceof Node).assert();
            this.map.get(N).set(this.version, null);
            this.setFlipped(N, false);
         }
      }
      remember(N: string, value: Node | number, flipped?: boolean) {
         let cell = this.map.getOrSet(N, () => new Cell<any>());
         (cell.get(this.version) == undefined).assert();
         cell.set(this.version, value);
         if (value instanceof Node)
            this.setFlipped(N, flipped ? true : false);
      }
      flipColors(Ns: (string | [string, string])[]) {
         for (let N of Ns) {
            if (typeof N == "string") {
               let node = this.get(N);
               let clr = node.color.get(this.version);
               clr = clr == "red" ? "black" : "red";
               node.color.set(this.version, clr);
            } else {
               let [to, from] = N;
               let ton = this.get(to);
               let fromn = this.get(from);
               let toc = ton.color.get(this.version);
               let fromc = fromn.color.get(this.version);
               if (toc != fromc) {
                  ton.color.set(this.version, fromc);
                  fromn.color.set(this.version, toc);
               }
            }
         }
      }
      flipAxes(Ns: string[]) {
         for (let N of Ns) {
            let node = this.get(N);
            this.setFlipped(N, !this.isFlipped(N));
         }
      }
      delete(N: string) {
         let node = this.get(N);
         let r = node.delete(this.version);
         this.forget([N]);
         return r;
      }
      private isFlipped(N: string) {
         let f0 = this.flipped.get(N);
         return f0 ? (f0.get(this.version) ? true : false) : false;
      }
      private setFlipped(N: string, value: boolean) {
         if (!value && !this.flipped.has(N))
            return;
         this.flipped.getOrSet(N, () => new Cell<boolean>()).set(this.version, value);
      }

      rotateUp(N: string, P: string) {
         let n = this.get(N);
         let p = this.get(P);
         (n.parent.get(this.version) == p).assert();
         let result = n.rotateUp(this.version);
         // copy to N.
         this.setFlipped(N, this.isFlipped(P));
      }
      compareAxis(P: string, N: string): boolean {
         let pA = this.isFlipped(P);
         let nA = this.isFlipped(N);
         if (pA == nA)
            return true;
         this.setFlipped(N, pA);
         return false;
      }
      expandLeafUnknown(N: string, dir: Dir, C: string): Color {
         let n = this.get(N);
         (dir != "root").assert();
         if (this.isFlipped(N))
            dir = dir == "left" ? "right" : "left";
         let lf = n.get(this.version, dir);
         if (lf == null || lf.color.get(this.version) == "black")
            return "black";
         else {
            this.remember(C, lf);
            return "red";
         }
      }
      expandLeafBlack(N: string, dir: Dir, C: string): "empty" | "notEmpty" {
         let n = this.get(N);
         (dir != "root").assert();
         if (this.isFlipped(N))
            dir = dir == "left" ? "right" : "left";
         let lf = n.get(this.version, dir);
         if (lf == null)
            return "empty";
         else {
            (lf.color.get(this.version) == "black").assert();
            this.remember(C, lf);
            return "notEmpty";
         }
      }
      expandRootFull(N: string, P: string, G: string): "black" | "red" | "empty" {
         let n = this.get(N);
         let dir = n.dir(this.version);
         if (dir == "root")
            return "empty";
         let p = n.parent.get(this.version);
         this.remember(P, p, dir == "right");
         if (p.color.get(this.version) == "black")
            return "black";
         else {
            let pdir = p.dir(this.version);
            (pdir != "root").assert();
            let g = p.parent.get(this.version);
            this.remember(G, g, pdir == "right");
            return "red";
         }
      }
      expandRootHalf(N: string, P: string): "notEmpty" | "empty" {
         let n = this.get(N);
         let dir = n.dir(this.version);
         if (dir == "root")
            return "empty";
         let p = n.parent.get(this.version);
         this.remember(P, p, dir == "right");
         return "notEmpty";
      }
      expandRootHalf2(P: string, G: string): "black" | "red" {
         let p = this.get(P);
         if (p.color.get(this.version) == "black")
            return "black";
         let pdir = p.dir(this.version);
         (pdir != "root").assert();
         let g = p.parent.get(this.version);
         this.remember(G, g, pdir == "right");
         return "red";
      }
      insertBin(N: string, value: number): void | Node {
         let n = new Node();
         n.color.set(this.version, "red");
         n.value.set(this.version, value);
         this.remember(N, n);
         let r = this.root.get(this.version);
         if (!r)
            return n;
         else r.insertBin(this.version, n)
      }
      swapToLeaf(N: string) {
         let n = this.get(N);
         let to = n.swapToLeaf(this.version);
         if (to != n) {
            this.map.get(N).set(this.version, to);
            let left = to.left.get(this.version);
            let right = to.right.get(this.version);
            (!left || !right).assert();
            this.setFlipped(N, left != null);
         }
      }
      unify(unify: dm.Unify) {
         // flip colors first.
         this.flipColors(unify.flipColors);
         this.flipAxes(unify.flipAxes);
         let nS = unify.nS.mapi(([into, from]) => {
            let fromN = this.get(from);
            (fromN != null).assert();
            return [into, fromN, this.isFlipped(from)] as [string, exe.Node, boolean];
         }).toArray();

         let seen = new Set<string>();
         for (let [into, from, flipped] of nS) {
            seen.add(into);
            let intoMap = this.map.getOrSet(into, () => new Cell<any>());
            intoMap.set(this.version, from);
            this.setFlipped(into, flipped);
         }
         let toForget = unify.nS.mapi(([a, b]) => b).filteri(b => !seen.has(b)).toArray();
         this.forget(toForget);
      }
   }
}



namespace tks {
   export type TokKind = "ID" | "KW" | "SN" | "NM" | "LB";
   export const ID: TokKind = "ID";
   export const KW: TokKind = "KW";
   export const SN: TokKind = "SN";
   export const NM: TokKind = "NM";
   export const LB: TokKind = "LB";
   export type Tok = [string, TokKind];
   export type Toks = Tok[];
   // keywords that might be used in identifier contexts, so just look for them. 
   export const keywords = new Set<string>(
      ["empty", "red", "black"]
   )
   // convenience type that can be translated into Toks.
   // allows us to use strings, numbers, etc... when specifying
   // renderings blow. 
   export type TokParam = Toks | string | number | boolean | { readonly on: Toks | string, readonly by: "parent" | "left" | "right" | "axis" | "color" };
   // translate TokParam into proper Toks. 
   export function toToks(param: TokParam): Toks {
      if (typeof param == "string")
         return [[param, keywords.has(param) ? tks.KW : tks.ID]];
      else if (param instanceof Array)
         return param
      else if (typeof param == "number")
         return [[param.toString(), tks.NM]];
      else if (typeof param == "boolean")
         return [[param ? "true" : "false", tks.NM]];
      else {
         let on = toToks(param.on);
         return on.concat([[".", tks.SN], [param.by, tks.ID]]);
      }
   }
   // generate Toks for assignment.
   export function assign(lhs: TokParam, rhs: TokParam) {
      return toToks(lhs).concat([[" = ", tks.SN]]).concat(toToks(rhs));
   }
   // generate Toks for equivalence.
   export function equiv(lhs: TokParam, ...rhsS: TokParam[]) {
      let ret = toToks(lhs);
      for (let rhs of rhsS)
         ret = ret.concat([[" == ", tks.SN]]).concat(toToks(rhs));
      return ret;
   }
   // generate Toks for a list of things separated by a comma. 
   export function mkList(toks: TokParam[], openClose?: [string, string]) {
      let ret: Toks = [[openClose ? openClose[0] : "(", tks.SN]];
      let isFirst = true;
      for (let t of toks) {
         if (isFirst)
            isFirst = false;
         else ret.push([", ", tks.SN]);
         ret.push(...toToks(t));
      }
      ret.push([openClose ? openClose[1] : ")", tks.SN])
      return ret;
   }
   // produces syntax of the form Node(red, P = Node(black))
   // used in case headers as pattern matches during expansions. 
   export function nodePattern(nm: string, clr: "red" | "black" | "unknown", parent?: Toks): Toks {
      let args: Toks[] = [];
      if (clr != "unknown")
         args.push([[clr, tks.KW]]);
      if (parent)
         args.push(parent);
      let ret: Toks = [["Node", tks.ID]];
      ret = ret.concat(tks.mkList(args));
      return tks.assign(nm, ret);
   }
}



namespace ebl {
   export type EContext = exe.Context;
   export type ENode = exe.Node;
   export type State = dm.Root;

   export function applyLabel(line: Header | Instruction, toks: tks.Toks) {
      return toks;
      /*
   */
   }
   export abstract class Instruction extends bbl.Instruction {
      get toks(): tks.Toks { return applyLabel(this, this.toks0); }
      protected abstract get toks0(): tks.Toks;
      abstract exec(txt: EContext): void | ENode | Instruction | Case | "error" | "return";
      readonly index: number;
      readonly parent: Block;
      constructor(parent: Line | Block) {
         super();
         let parent0 = parent instanceof Block ? parent : parent.tag == "header" ? parent.block : parent.parent;
         this.parent = parent0;
         this.index = parent0.instructions.length;
      }
   }



   export abstract class Basic extends Instruction {
      isSwitch(): false { return false; }
      constructor(parent: Line | Block, public state: State) {
         super(parent);
      }
      abstract exec(txt: EContext): void | ENode;
   }
}
namespace ebl {
   export class Compress extends Basic {
      get adbg() { return "compress(" + this.Ns.format() + ")"; }
      constructor(parent: Block | Line, state: State, readonly Ns: string[]) {
         super(parent, state);
      }
      exec(txt: EContext) { return txt.forget(this.Ns); }
      protected get toks0() {
         return tks.toToks("compress").concat(tks.mkList(this.Ns));
      }
   }
   export class RotateUp extends Basic {
      get adbg() { return "rotateUp(" + this.N + ")"; }
      constructor(parent: Block | Line, state: State, readonly N: string, readonly P: string) {
         super(parent, state);
      }
      exec(txt: EContext) { return txt.rotateUp(this.N, this.P); }
      protected get toks0() {
         return tks.toToks("rotateUp").concat(tks.mkList([this.N]));
      }
   }
   export abstract class Flip<T> extends Basic {
      abstract get Ns(): T[];
      recycle(newValue: T, newState: State): () => void {
         this.proc.unregister(this);
         this.Ns.push(newValue);
         let oldState = this.state;
         this.state = newState;
         this.proc.register(this);
         return () => {
            this.proc.unregister(this);
            this.state = oldState;
            this.Ns.pop();
            this.proc.register(this);
         }
      }
   }

   export class FlipAxis extends Flip<string> {
      get adbg() { return "flipAxes(" + this.Ns.format() + ")"; }
      constructor(parent: Block | Line, state: State, readonly Ns: string[]) {
         super(parent, state);
      }
      exec(txt: EContext) { return txt.flipAxes(this.Ns); }
      protected get toks0() {
         return tks.toToks("flipAxes").concat(tks.mkList(this.Ns));
      }
   }
   export class FlipColor extends Flip<string | [string, string]> {
      get adbg() { return "flipColors(" + this.Ns.format(a => a instanceof Array ? a[0] : a) + ")"; }
      constructor(parent: Block | Line, state: State, readonly Ns: (string | [string, string])[]) {
         super(parent, state);
      }
      exec(txt: EContext) { return txt.flipColors(this.Ns); }
      protected get toks0() {
         return tks.toToks("flipColors").concat(tks.mkList(this.Ns.map(s => {
            if (typeof s == "string")
               return s;
            else return s[0];
         })));
      }
   }
   export class Delete extends Basic {
      get adbg() { return "delete(" + this.N + ")"; }
      constructor(parent: Block | Line, state: State, readonly N: string) {
         super(parent, state);
      }
      exec(txt: EContext) { return txt.delete(this.N); }
      protected get toks0() {
         return tks.toToks("delete").concat(tks.mkList([this.N]));
      }
   }
   export class AddHeightVar extends Basic {
      get adbg() {
         return "addHeightVar(" + this.k + ", " + this.value + ", " +
            this.args.format(([a, b]) => a + "." + b) + ")";
      }
      exec(txt: EContext) { return; }
      constructor(parent: Block | Line, state: State, readonly k: string, readonly value: number, readonly args: [string, "left" | "right" | "parent"][]) {
         super(parent, state);
      }
      protected get toks0() {
         let args: tks.TokParam[] = [];
         args.push(this.k, this.value);
         args.push(...this.args.map(([a, b]) => {
            return {
               on: a, by: b
            }
         }));
         return tks.toToks("addHeightVar").concat(tks.mkList(args));
      }
   }
   export class InsertBin extends Basic {
      get adbg() {
         return this.N + " = insertBin(" + this.V + ")";
      }
      constructor(parent: Block | Line, state: State, readonly N: string, readonly V: string) {
         super(parent, state);
      }
      exec(txt: EContext) { return txt.insertBin(this.N, txt.map.get(this.V).get(txt.version) as number); }
      protected get toks0() {
         let rhs = tks.toToks("insertBin").concat(tks.mkList([this.V]));
         return tks.assign(this.N, rhs);
      }
   }
   export class SwapToLeaf extends Basic {
      get adbg() {
         return this.N + " = swapToLeaf(" + this.N + ")";
      }
      constructor(parent: Block | Line, state: State, readonly N: string) {
         super(parent, state);
      }
      exec(txt: EContext) { return txt.swapToLeaf(this.N); }
      protected get toks0() {
         return tks.assign(this.N, tks.toToks("swapToLeaf").concat(tks.mkList([this.N])));
      }
   }
}
namespace ebl {
   export abstract class Case extends bbl.Case {
      readonly index: number;
      constructor(readonly owner: Switch, readonly state: State) {
         super(owner);
         this.index = owner.cases.length;
         owner.cases.push(this);
      }
      protected abstract get onToks(): tks.Toks;
      get toks(): tks.Toks {
         let ret: tks.Toks = [["case ", tks.KW]];
         return applyLabel(this, ret.concat(this.onToks));
      }
   }

   class SwitchFooter extends Footer {
      constructor(readonly owner: Switch) {
         super();
      }
      get toks(): tks.Toks { return [["endswitch", tks.KW]]; }
      get adbg() { return "endswitch"; }
      get state() { return this.owner.breakState; }
   }
   export abstract class Switch extends Instruction {
      breakState: State;
      readonly cases = new Array<Case>();
      readonly footer: SwitchFooter;
      isSwitch(): true { return true; }
      get isPassThroughState() { return true; }
      get state() { return this.previous.state; }
      constructor(parent: Block | Line) {
         super(parent);
         this.footer = new SwitchFooter(this);
      }
      abstract exec(txt: EContext): Case | "error";
      protected abstract get onToks(): tks.Toks;
      protected get toks0(): tks.Toks {
         let ret: tks.Toks = [];
         ret.push(["switch ", tks.KW]);
         ret.push(...this.onToks);
         return ret;
      }
   }
}

namespace ebl {
   abstract class CaseT<Owner extends Switch> extends Case {
      constructor(owner: Owner, state: State) {
         super(owner, state);
      }
   }
   interface CaseT<Owner> {
      readonly owner: Owner;
   }
   function retHeader(line: Header | Instruction): Instruction | "error" {
      if (line instanceof Instruction)
         return line;
      else if (line.block.instructions.length == 0)
         return "error";
      else return line.block.instructions[0];
   }



   export class AxisTrueCase extends CaseT<CompareAxis> {
      get adbg() { return "true"; }
      protected get onToks() { return tks.toToks(true); }
   }
   export class AxisFalseCase extends CaseT<CompareAxis> {
      get adbg() { return "false"; }
      protected get onToks() { return tks.toToks(false); }
   }
   export class CompareAxis extends Switch {
      get adbg() { return this.A + " = compareAxis(" + this.P + ", " + this.N + ")"; }
      readonly onTrue: AxisTrueCase;
      readonly onFalse: AxisFalseCase;
      constructor(parent: Block | Line, readonly P: string, readonly N: string, readonly A: string, onTrue: State, onFalse: State) {
         super(parent);
         this.onTrue = new AxisTrueCase(this, onTrue);
         this.onFalse = new AxisFalseCase(this, onFalse);
      }
      exec(txt: EContext): Case | "error" {
         let result = txt.compareAxis(this.P, this.N);
         return (result ? this.onTrue : this.onFalse);
      }
      protected get onToks(): tks.Toks {
         return tks.assign(
            this.A,
            tks.toToks("compareAxis").concat(tks.mkList([this.P, this.N]))
         );
      }

   }

   export abstract class ExpandLeaf extends Switch {
      get adbg() { return "switch " + this.N + this.dir; }
      constructor(parent: Block | Line, readonly N: string, readonly dir: "left" | "right") {
         super(parent);
      }
      protected get onToks() {
         return tks.toToks({
            on: this.N,
            by: this.dir,
         });
      }
   }

   export class BlackLeafCase extends CaseT<ExpandLeafUnknown> {
      get adbg() { return "black"; }
      protected get onToks() { return tks.toToks("black"); }
   }
   export class RedLeafCase extends CaseT<ExpandLeafUnknown> {
      get adbg() { return this.owner.C + " = Node(red)"; }
      protected get onToks() { return tks.nodePattern(this.owner.C, "red"); }
   }
   export class ExpandLeafUnknown extends ExpandLeaf {
      get adbg() { return super.adbg + " (unknown)"; }
      readonly black: BlackLeafCase;
      readonly red: RedLeafCase;
      constructor(parent: Block | Line, N: string, dir: "left" | "right", readonly C: string, onBlack: State, onRed: State) {
         super(parent, N, dir);
         this.black = new BlackLeafCase(this, onBlack);
         this.red = new RedLeafCase(this, onRed);
      }
      exec(txt: EContext): Case | "error" {
         let result = txt.expandLeafUnknown(this.N, this.dir, this.C);
         return (result == "black" ? this.black : this.red);
      }
   }

   export class EmptyCase extends CaseT<ExpandLeafBlack | ExpandFullRoot | ExpandHalfRoot> {
      get adbg() { return "empty"; }
      protected get onToks() { return tks.toToks("empty"); }
   }
   export class LeafNotEmptyCase extends CaseT<ExpandLeafBlack> {
      get adbg() { return this.owner.C + " = Node(black)"; }
      protected get onToks() { return tks.nodePattern(this.owner.C, "black"); }
   }
   export class ExpandLeafBlack extends ExpandLeaf {
      get adbg() { return super.adbg + " (black)"; }
      readonly notEmpty: LeafNotEmptyCase;
      readonly empty: EmptyCase;
      constructor(parent: Block | Line, N: string, dir: "left" | "right", readonly C: string, onNotEmpty: State, onEmpty?: State) {
         super(parent, N, dir);
         this.notEmpty = new LeafNotEmptyCase(this, onNotEmpty);
         this.empty = onEmpty ? new EmptyCase(this, onEmpty) : null;
      }
      exec(txt: EContext): Case | "error" {
         let result = txt.expandLeafBlack(this.N, this.dir, this.C);
         return (result == "empty" ? this.empty : this.notEmpty);
      }
   }
   export class BlackRootCase extends CaseT<ExpandFullRoot | ExpandHalf2Root> {
      get adbg() { return this.owner.P + " = Node(black)"; }
      protected get onToks() { return tks.nodePattern(this.owner.P, "black"); }
   }
   export class RedRootCase extends CaseT<ExpandFullRoot | ExpandHalf2Root> {
      get adbg() { return this.owner.P + " = Node(red, " + this.owner.G + " = Node(black)" + ")"; }
      protected get onToks() { return tks.nodePattern(this.owner.P, "red", tks.nodePattern(this.owner.G, "black")); }
   }
   export abstract class ExpandRoot extends Switch {
      get adbg() { return "switch " + this.N + ".parent"; }
      constructor(parent: Block | Line, readonly N: string, readonly P: string) {
         super(parent);
      }
      protected get onToks() {
         return tks.toToks({ on: this.N, by: "parent" })
      }
   }
   export class ExpandFullRoot extends ExpandRoot {
      get adbg() { return super.adbg + " (full)"; }
      readonly black: BlackRootCase;
      readonly red: RedRootCase;
      readonly empty: EmptyCase;
      constructor(parent: Block | Line, N: string, P: string, readonly G: string, black: State, red: State, empty: State) {
         super(parent, N, P);
         this.black = new BlackRootCase(this, black);
         this.red = new RedRootCase(this, red);
         this.empty = new EmptyCase(this, empty);
      }
      exec(txt: EContext): Case | "error" {
         let result = txt.expandRootFull(this.N, this.P, this.G);
         return (result == "empty" ? this.empty : result == "red" ? this.red : this.black);
      }
   }
   export class RootNotEmptyCase extends CaseT<ExpandHalfRoot> {
      get adbg() { return this.owner.P + " = Node"; }
      protected get onToks() { return tks.nodePattern(this.owner.P, "unknown"); }
   }
   export class ExpandHalfRoot extends ExpandRoot {
      get adbg() { return super.adbg + " (half)"; }
      readonly notEmpty: RootNotEmptyCase;
      readonly empty: EmptyCase;
      constructor(parent: Block | Line, N: string, P: string, notEmpty: State, empty: State) {
         super(parent, N, P);
         this.notEmpty = new RootNotEmptyCase(this, notEmpty);
         this.empty = new EmptyCase(this, empty);
      }
      exec(txt: EContext): Case | "error" {
         let result = txt.expandRootHalf(this.N, this.P);
         let caze = result == "notEmpty" ? this.notEmpty : this.empty;
         return (caze);
      }
   }
   export class ExpandHalf2Root extends Switch {
      get adbg() { return "switch " + this.P; }
      readonly black: BlackRootCase;
      readonly red: RedRootCase;
      constructor(parent: Block | Line, readonly P: string, readonly G: string, black: State, red: State) {
         super(parent);
         this.black = new BlackRootCase(this, black);
         this.red = new RedRootCase(this, red);
      }
      exec(txt: EContext): Case | "error" {
         let result = txt.expandRootHalf2(this.P, this.G);
         let caze = result == "black" ? this.black : this.red;
         return (caze);
      }
      protected get onToks() { return tks.toToks(this.P); }
   }
   export class Goto extends Instruction {
      isInvisible: boolean = false;
      newAdd: boolean = true;
      get isPassThroughState(): true { return true; }
      isSwitch(): false { return false; }
      get state() { return this.target.state; }
      private get unify() {
         let prevState = this.previous.state;
         let unify = prevState.checkUnify(this.target.state);
         if (!unify)
            throw new Error();
         return unify;
      }
      constructor(parent: Block | Line, readonly target: Instruction | Header) {
         super(parent);
      }
      exec(txt: EContext) {
         txt.unify(this.unify);
         return retHeader(this.target);
      }
      get adbg() {
         let unify = this.unify;
         return "goto " + (this.proc as Proc).labelFor(this.target) + " " + unify.adbg;
      } // unification
      protected get toks0(): tks.Toks {
         let lbl: tks.Tok = [(this.proc as Proc).labelFor(this.target).toString() + " ", tks.LB];
         let kw: tks.Tok = ["goto ", tks.KW];
         let unify = this.unify;
         let unifyArgs: tks.Toks[] = [];
         for (let [to, from] of unify.hS) {
            let rhs: tks.Toks;
            if (from.tag == "var") {
               if (from.varName == to && from.varAdjust == 0)
                  continue;
               let v: tks.Tok = [from.varName, tks.ID];
               if (from.varAdjust == 0)
                  rhs = [v];
               else {
                  let sign: tks.Tok = [from.varAdjust > 0 ? " + " : " - ", tks.KW];
                  rhs = [v, sign].concat(tks.toToks(Math.abs(from.varAdjust)));
               }
            } else rhs = tks.toToks(from.concrete);
            unifyArgs.push(tks.assign(to, rhs));
         }
         for (let [to, from] of unify.aS) {
            let rhs: tks.Toks;
            if (from.isVar()) {
               if (from.varName == to)
                  continue;
               else rhs = tks.toToks(from.varName);
            } else rhs = [[from.adbg, tks.KW]];
            unifyArgs.push(tks.assign(to, rhs));
         }
         for (let [to, from] of unify.nS) {
            if (to == from)
               continue;
            unifyArgs.push(tks.assign(to, from));
         }
         if (unify.flipColors.length > 0)
            unifyArgs.push(tks.toToks("color").concat(tks.mkList(unify.flipColors)));
            if (unify.flipAxes.length > 0)
            unifyArgs.push(tks.toToks("axis").concat(tks.mkList(unify.flipAxes)));
         let ret: tks.Toks = [kw, lbl];
         if (unifyArgs.length > 0)
            ret = ret.concat(tks.mkList(unifyArgs));
         return ret;
      }
      get status(): "closed" { return "closed"; }
   }
   export class Return extends Instruction {
      isSwitch(): false { return false; }
      get isPassThroughState(): true { return true; }
      get state(): State { return this.previous.state; }
      protected get toks0(): tks.Toks { return [["return", tks.KW]]; }
      get adbg() { return "return"; }
      exec(txt: EContext): "return" {
         return "return";
      }
      get status(): "closed" { return "closed"; }
   }





}

namespace dm {
   export interface Image {
      generate(r: Random, binding: Map<string, number | boolean | [exe.Node, boolean]>, min: number, max: number, parent?: RootParent): exe.Node;
   }
   function makeTree(k: number, min: number, max: number, isBlack: boolean, r: Random, blackChance = 2): exe.Node {
      let clr: exe.Color = isBlack || (r.nextN(blackChance) == 0) ? "black" : "red";
      if (clr == "black" && k == 1)
         return null;
      let value = Math.round((min + max) / 2);
      (value > min && value < max).assert();

      let k0 = clr == "black" ? k - 1 : k;
      (k0 >= 1).assert();
      let left = makeTree(k0, min, value, clr == "red", r, blackChance);
      let right = makeTree(k0, value, max, clr == "red", r, blackChance);
      return exe.Node.make({
         value: value,
         color: clr,
         left: left,
         right: right,
      })
   }
   export interface RootParent {
      generate(r: Random, binding: Map<string, number | boolean | [exe.Node, boolean]>, min: number, max: number, parent?: null, height?: number, canBeRed?: boolean): exe.Node;
   }

   const blackChance = 3;
   function nextColor(r: Random, isBlack?: boolean): exe.Color {
      return isBlack || (r.nextN(blackChance) == 0) ? "black" : "red";
   }
   function evalHeight(h: Height, r: Random, binding: Map<string, number | boolean | [exe.Node, boolean]>) {
      if (h.tag == "concrete")
         return h.concrete;
      if (!binding.has(h.varName)) {
         let v = r.nextN(5);
         if (v == 0)
            v = 1;
         else v = Math.round(v / 2);
         binding.set(h.varName, v);
      }
      let ret = binding.get(h.varName) as number;
      ret = ret + h.varAdjust;
      (ret >= 1).assert();
      return ret;
   }

   RootParent.prototype.generate = function (r, binding, min, max, parent, height, canBeRed) {
      let self = this as RootParent;
      if (height == undefined) {
         height = r.nextN(5);
         if (height != 0)
            height = Math.round(height / 2);
      }
      if (self.height == "empty" || (height == 0 && (!canBeRed || r.nextN(2) == 0)))
         return self.child.generate(r, binding, min, max, self);
      (height > 0 || canBeRed).assert();
      let color = height == 0 ? "red" : nextColor(r, canBeRed ? false : true);
      let childHeight = color == "red" ? height : height - 1;
      (childHeight >= 0).assert();
      let recurse = new RootParent(self.child, self.height, self.hasOpen);
      let leaf = new Leaf(self.height.add(childHeight), color == "red" ? "black" : "unknown", false);

      let value = Math.round(min.lerp(max, .5));
      let isLeft = r.nextN(2) == 0;
      let left = (isLeft ? recurse : leaf).generate(r, binding, min, value, self as null, childHeight, color == "black");
      let right = (!isLeft ? recurse : leaf).generate(r, binding, value, max, self as null, childHeight, color == "black");
      // the node. 
      return exe.Node.make({
         value: value,
         color: color,
         left: left,
         right: right,
      })
   }
   Leaf.prototype.generate = function (r, binding, min, max) {
      let self = this as Leaf;
      let height = evalHeight(self.height, r, binding);
      let color = nextColor(r, self.color == "black");
      if (color == "black" && height == 1)
         return null;
      let nextHeight = color == "red" ? height : height - 1;
      (nextHeight >= 1).assert();
      let value = Math.round(min.lerp(max, .5));
      let nextLeaf = new dm.Leaf(dm.BaseHeight.concrete(nextHeight), color == "red" ? "black" : "unknown", false);
      let left = nextLeaf.generate(r, binding, min, value);
      let right = nextLeaf.generate(r, binding, value, max);
      return exe.Node.make({
         value: value,
         color: color,
         left: left,
         right: right,
      })
   }
   Node.prototype.generate = function (r, binding, min, max, parent) {
      let self = this as Node;

      let color: "red" | "black";
      if (self.color == "unknown") {
         color = r.nextN(2) == 0 ? "black" : "red";
         if (color == "red" && parent instanceof RootParent && parent.height != "empty") {
            let [left0, right0] = [self.left, self.right];
            if (left0 instanceof Leaf && left0.hasOpen)
               left0 = new Leaf(left0.height, "black", false);
            if (right0 instanceof Leaf && right0.hasOpen)
               right0 = new Leaf(right0.height, "black", false);
            let leaf = new Leaf(parent.height.add(-1), "unknown", false);
            let rnode = new dm.Node(self.name, color, self.axis, left0, right0);
            let bnode = new dm.Node(null, "black", dm.Axis.Wild, rnode, leaf);
            return bnode.generate(r, binding, min, max, parent);
         }
      } else color = self.color;

      let value = Math.round(min.lerp(max, .5));
      let flip = false;
      if (self.left.equals(self.right)) { }
      else if (self.axis.isVar()) {
         if (binding.has(self.axis.varName))
            flip = binding.get(self.axis.varName) as boolean;
         else {
            flip = r.nextN(2) == 0;
            binding.set(self.axis.varName, flip);
         }
      } else if (self.axis == dm.Axis.Minus)
         flip = true;
      else if (self.axis == dm.Axis.Wild)
         flip = r.nextN(2) == 0;
      else (self.axis == dm.Axis.Plus).assert();

      let [left0, right0] = [self.left, self.right];
      if (flip)
         [left0, right0] = [right0, left0];
      let left = left0.generate(r, binding, min, value);
      let right = right0.generate(r, binding, value, max);
      let ret = exe.Node.make({
         value: value,
         left: left,
         right: right,
         color: color,
      });
      if (self.name)
         binding.set(self.name, [ret, flip]);
      return ret;
   }
   JustTree.generate = function (r, binding, min, max) {
      let h = r.nextN(10);
      if (h == 0)
         return null;
      else h = Math.ceil(h / 3);
      let leaf = new dm.Leaf(dm.BaseHeight.concrete(h), "black", false);
      return leaf.generate(r, binding, min, max);
   }
}