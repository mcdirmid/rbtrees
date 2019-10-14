// this file combines domain and render so the images defined in
// domain can be rendered and manipulated. However, it lacks a
// way of organizing manipulations, which will be defined later
// in instructions.ts via blocks.ts.
namespace dm {
   // update image with rendering image,
   // have it  to compute a top center X anchor while rendering.
   export interface Image extends rn.Image {
      renderCore0(txt: rndm.Context, addr: dm.Address): [Vector2D, number];
      anchorX?: number;
   }
}

namespace rndm {
   // just an upgraded context type. 
   export interface Context extends rn.Context {
      readonly host: Host;
      renderImage(elem: dm.Image, pos: Vector2D, addr: dm.Address): void;
   }
   // host modified with all image transmutation operations. 
   // these will be filled in later when the actions can be organized in
   // instructions.
   export abstract class Host extends rn.Host {
      tryFlipColor(addr: dm.NodeAddress): false | rn.Do { return false; }
      tryFlipAxis(addr: dm.NodeAddress): false | rn.Do { return false; }
      tryRotateUp(addr: dm.NodeAddress): false | rn.Do { return false; }
      tryCompress(addr: dm.NodeAddress | dm.RootParentAddress): false | rn.Do {
         return false;
      }
      tryHeightVar(addr: dm.LeafAddress | dm.RootParentAddress): false | rn.Do {
         return false;
      }
      tryDelete(addr: dm.NodeAddress): false | rn.Do { return false; }

      tryExpandLeaf(addr: dm.LeafAddress): false | rn.Do { return false; }
      tryExpandRootFull(addr: dm.RootParentAddress): false | rn.Do { return false; }
      tryCompareAxis(addr: dm.NodeAddress): false | rn.Target { return false; }

      tryExpandRootHalf(addr: dm.RootParentAddress): false | rn.Do { return false; }
      tryExpandRootHalf2(addr: dm.RootParentAddress): false | rn.Do { return false; }

   }
   function or(...aS: (() => false | rn.Do)[]): () => false | rn.Do {
      return () => {
         for (let a of aS) {
            let a0 = a();
            if (a0)
               return a0;
         }
         return false;
      }
   }

   // capture/check x-anchor
   dm.Image.prototype.renderCore = function (txt, addr) {
      let self = this as dm.Image;
      ((addr as dm.Address).image == self).assert();
      let [sz, ax] = self.renderCore0(txt as Context, addr as dm.Address);
      if (self.anchorX == undefined) {
         txt.isDoingSize.assert();
         self.anchorX = ax;
      } else (self.anchorX.dist(ax) < .01).assert();
      return sz;
   }
   // leaf render is pretty simple, just a triangle.
   dm.Leaf.prototype.renderCore0 = function (txt, addr: dm.LeafAddress) {
      let self = this as dm.Leaf;
      let lbl = self.height.adbg;
      let r = Math.ceil(txt.standardRad(lbl));
      let sz = txt.strokeTriangle(Vector2D.Zero, r * 2, [lbl, false], {
         label: "main",
         addr: addr,
         acts: [
            // input actions. 
            ["down", () => txt.host.tryExpandLeaf(addr)],
            ["left", () => txt.host.tryHeightVar(addr)]
         ]
      });
      // if black, then put a black dot on its top corner.
      if (self.color == "black" || self.hasOpen)
         txt.fillSmallCircle(
            (sz.x / 2).vec(0),
            self.hasOpen ? RGB.white : RGB.black,
            null,
            self.hasOpen ? true : undefined
         );
      return [sz, (sz.x / 2)];
   }
   dm.RootParent.prototype.renderCore0 =
      function (txt, addr: dm.RootParentAddress) {
         let self = this as dm.RootParent;
         let lbl = self.height == "empty" ? "ϵ" : self.height.adbg;
         // ax is anchor or zero if anchor doesn't exist yet. 
         let ax = self.anchorX ? self.anchorX : 0;
         let r = txt.standardRad(lbl);
         let tsz = txt.strokeTriangle((ax - r).vec(0), r * 2, [lbl, self.height != "empty"], {
            label: "main",
            addr: addr,
            acts: [
               //["down", () => txt.host.tryExpandRoot(addr)],
               ["down",
                  or(() => txt.host.tryExpandRootHalf(addr),
                     () => txt.host.tryExpandRootHalf2(addr))],
               ["up", () => txt.host.tryCompress(addr)],
               ["left", () => txt.host.tryHeightVar(addr)],
            ]
         });
         // h is where the child will go, draw a line to child. 
         let h = Math.ceil(tsz.y) + txt.SW * 2;
         txt.g.strokeLine([ax.vec(Math.ceil(tsz.y)), ax.vec(h)])
         // compute child x position, usually 0 since
         // child is wider than triangle. 
         // only compute cx any further if anchors
         // are already computed. 
         let cx = 0;
         if (self.child.anchorX && self.anchorX) {
            (self.child.anchorX <= ax).assert();
            cx = ax - self.child.anchorX;
         }
         txt.renderImage(self.child, (cx).vec(h), addr.child);
         {
            (self.child.anchorX != null && self.child.size != null).assert();
            // usually the child is wider, but just in case
            // max with the triangle size. 
            let ax = self.child.anchorX.max(tsz.x / 2)
            let w = ax +
               (self.child.size.x - self.child.anchorX).max(tsz.x / 2);

            (!self.size || self.size.x.dist(w) <= .01).assert();
            return [Math.ceil(w).vec(Math.ceil(h + self.child.size.y)), Math.ceil(ax)];
         }
      }
   // just a triangle.
   dm.JustTree.renderCore0 = function (txt, addr) {
      (this == dm.JustTree).assert();
      let r = txt.standardRad("X");
      // no input, but still needs to have address and label
      // as it might be the target of a freeze. 
      let sz = txt.strokeTriangle(Vector2D.Zero, r * 2, null, {
         addr: addr,
         label: "main",
      });
      return [sz, sz.x / 2];
   }
   dm.Node.prototype.renderCore0 = function (txt, addr: dm.NodeAddress) {
      let self = this as dm.Node;
      let ax = self.anchorX ? self.anchorX : 0;
      let r = txt.standardRad(self.name);
      // render for node color must come first because
      // it overlaps with the node's main body and needs
      // to sniff its own input (input is bubble down, if we
      // did bubble up, we would have to be put this call
      // after the main render). 
      txt.fillSmallCircle(ax.vec(r).add((r / 2).vec(-r / 2)),
         self.color == "red" ? RGB.red :
            self.color == "black" ? RGB.black :
               RGB.white, {
            label: "color",
            addr: addr,
            acts: [
               ["click", () => txt.host.tryFlipColor(addr)]
            ]
         }, self.color == "unknown" ? true : undefined);
      if (!self.left.equals(self.right)) {
         let lbl = self.axis.adbg;
         txt.fillText((ax).vec(r * 2), lbl, {
            label: "axis",
            addr: addr,
            acts: [
               ["up", () => txt.host.tryFlipAxis(addr)],
               ["target", () => txt.host.tryCompareAxis(addr)]
            ]
         }, "center")
      }
      txt.strokeCircle(ax.vec(r), r, self.name, {
         label: "main",
         addr: addr,
         acts: [
            ["up", () => txt.host.tryCompress(addr)],
            ["down", () => txt.host.tryRotateUp(addr)],
            ["right", () => txt.host.tryDelete(addr)],
         ]
      })
      let h = 2 * r + txt.SW * 2;
      // render left and right trees.
      // this doesn't handle the case where left and right child are narrower
      // than "r", but that is very unlikely anyways.
      txt.renderImage(self.left, (0).vec(h), addr.left);
      txt.renderImage(self.right, (self.left.size.x + txt.SW).vec(h), addr.right);

      let lax = self.left.anchorX;
      let rax = self.left.size.x + txt.SW + self.right.anchorX;
      // findC will figure out where to anchor tree lines on node.
      function findC(p: Vector2D) {
         // c - lx + lx = c
         let delta = (ax.vec(r)).minus(p);
         return delta.normal().mult(delta.length() - r).add(p);
      }
      let lk = lax.vec(h - txt.SW);
      let lp = findC(lk);
      let rk = rax.vec(lk.y);
      let rp = findC(rk);
      txt.g.strokeLine([lp, lk, lax.vec(h)]);
      txt.g.strokeLine([rp, rk, rax.vec(h)])
      return [
         (self.left.size.x + txt.SW + self.right.size.x).vec(
            h + self.left.size.y.max(self.right.size.y)),
         lax.lerp(rax, .5),
      ]
   }



}

namespace dm {
   // forward host on as a class rather than type
   // so it can be extended and implemented.
   export abstract class Host extends rndm.Host {
      abstract root: dm.Root;
      renderChild(pos: Vector2D, txt: rn.Context): Vector2D {
         if (!this.root)
            return Vector2D.Zero;
         txt.renderImage(this.root, pos, this.root.addr);
         return this.root.size;
      }
   }
}
// testing. 
namespace rndmtest {
   type Address = dm.Address;
   class Host extends dm.Host {
      root: dm.Root;

      get offset() { return (100).vec(); }
      constructor(readonly parent: ui2.Top) {
         super();
         parent.child = this;
      }
      private f<T extends dm.Address>(g: false | (() => T)): false | rn.Do {
         if (!g)
            return false;
         let g0 = g;
         return () => {
            let oldRoot = this.root;
            let newAddr = g0();
            this.root = newAddr.root
            return [() => {
               this.root = oldRoot;
            }, newAddr];
         }
      }
      tryRotateUp(addr: dm.NodeAddress): false | rn.Do {
         return this.f(addr.image.tryRotateUp(addr));
      }
      tryCompress(addr: dm.NodeAddress): false | rn.Do {
         let f = addr.image.tryCompress(addr);
         let f0 = !f ? false : () => {
            if (!f)
               throw new Error();
            return f()[0];
         }
         return this.f(f0);
      }
      tryCompressRoot(addr: dm.RootParentAddress): false | rn.Do {
         let f = addr.image.tryCompress(addr);
         let f0 = !f ? false : () => {
            if (!f)
               throw new Error();
            return f()[0];
         }
         return this.f(f0);
      }
      tryFlipColor(addr: dm.NodeAddress): false | rn.Do {
         let f = addr.image.tryFlipColor(addr);
         if (!f)
            return false;
         let f0 = f;
         let f1 = () => f0()[0];
         return this.f(f1);
      }
      tryCompareAxis(addr: dm.NodeAddress): false | rn.Target {
         let node = addr.image;
         if (node.left.equals(node.right))
            return false;
         if (node.axis == dm.Axis.Wild || node.axis.isVar()) { }
         else return false;

         return (other: dm.NodeAddress) => {
            let ret = other.image.tryCompareAxis(other, addr);
            if (!ret)
               return false;
            let f = ret;
            return () => {
               let ret = f("𝛼")
               let oldRoot = this.root;
               this.root = ret.flipped.root;
               return [() => {
                  this.root = oldRoot;
               }, ret.flipped];
            }
         }
      }
   }

   export function test() {
      let empty = new dm.Leaf(dm.HeightImpl.usingVar("k", 0), "black", false);
      let N = new dm.Node("N", "red", dm.Axis.Wild, empty, empty);
      let P = new dm.Node("P", "red", dm.Axis.Wild, N, empty);
      let G = new dm.Node("G", "black", dm.Axis.Wild, P, empty);
      let R = new dm.RootParent(G, dm.HeightImpl.usingVar("k", 1), false);

      let top = ui2.Top.useWindow();
      let h = new Host(top);
      h.root = R;
      top.renderAll();

   }
}