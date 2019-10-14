
const e1 = new Map([
   [1, "one"],
   [2, "two"],
   [3, "three"],
   [4, "four"],
   [5, "five"],
   [6, "six"],
   [7, "seven"],
   [8, "eight"],
   [9, "nine"],
]);
const e2 = new Map([
   [2, "twenty"],
   [3, "thirty"],
   [4, "fourty"],
   [5, "fifty"],
   [6, "sixty"],
   [7, "seventy"],
   [8, "eighty"],
   [9, "ninety"],
]);
const powers : [number,string][] = ([
   [2, "hundred"],
   [3, "thousand"],
   [6, "million"],
   [9, "billion"],
   [12, "trillion"],
   [15, "quadrillion"],
])

const ten2twenty = new Map([
   [10, "ten"],
   [11, "eleven"],
   [12, "twelve"],
   [13, "thirteen"],
   [14, "fourteen"],
   [15, "fifteen"],
   [16, "sixteen"],
   [17, "seventeen"],
   [18, "eighteen"],
   [19, "nineteen"],
]);

function assert(b : boolean) {}

function numberToWords(n : number) : string {
   for (let i = powers.length - 1; i >= 0; i -= 1) {
      let cmp = Math.pow(10, powers[i][0]);
      if (n >= cmp) {
         let m = n % cmp;
         let q = (n - m) / cmp;
         assert(q >= 1);
         let mS = m == 0 ? "" : " " + numberToWords(m);
         let qS = numberToWords(q) + " " + powers[i][1];
         return qS + mS;
      }
   }
   assert(n < 100);
   if (n == 0)
      return "zero";
   else if (n < 10)
      return e1.get(n);
   else if (n < 20)
      return ten2twenty.get(n);
   else {
      let m = n % 10;
      let q = (n - m) / 10;
      assert(q >= 2 && q <= 9);
      return e2.get(q) + (m == 0 ? "" : " " + e1.get(m));
   }
}