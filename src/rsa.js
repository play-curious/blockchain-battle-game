import Sha1 from "./sha1.js";

export function calculateHash(message) {
  const hash = Sha1.hash(message);
  // Use BigInts to get around problem of dealing with large values
  const shortened = JSBI.remainder(
    JSBI.BigInt("0x" + hash),
    JSBI.BigInt(10000)
  );
  return shortened.toString().padStart(4, "0");
}

// q et p must be 2 prime numbers
export function createKeys(q, p) {
  let n = p * q;
  let phin = (p - 1) * (q - 1);

  let min;
  p > q ? (min = p) : (min = q);

  let e;

  for (let i = min + 1; i < phin; i++) {
    if (GCD(phin, i) == 1) {
      e = i;
      break;
    }
  }
  let d;
  for (let i = min + 1; i < phin; i++) {
    if ((e * i) % phin == 1) {
      d = i;
      break;
    }
  }

  return { n: n, phin: phin, public: e, private: d };
}

// Returns a number as a string
export function crypt(message, key, n) {
  let crypted = _.map(message, char => {
    // With BigInt:
    // const result = BigInt(char.charCodeAt(0)) ** BigInt(key) % BigInt(n);

    const result = JSBI.remainder(
      JSBI.exponentiate(JSBI.BigInt(char.charCodeAt(0)), JSBI.BigInt(key)),
      JSBI.BigInt(n)
    );
    return result.toString().padStart(3, "0");
  });
  return crypted.join("");
}

export function decrypt(message, key, n) {
  const messageChunks = _.chain(message)
    .chunk(3)
    .map(x => parseInt(x.join("")))
    .value();
  const decrypted = _.map(messageChunks, x => {
    // With BigInt:
    // let result = BigInt(x) ** BigInt(key) % BigInt(n);
    // return String.fromCharCode(Number(result));

    const result = JSBI.remainder(
      JSBI.exponentiate(JSBI.BigInt(x), JSBI.BigInt(key)),
      JSBI.BigInt(n)
    );
    return String.fromCharCode(JSBI.toNumber(result));
  });
  return decrypted.join("");
}

export function concat(key, n) {
  let theKey = key.toString();
  let theN = n.toString();
  theKey = theKey.padStart(3, "0");
  theN = theN.padStart(3, "0");

  return theKey + theN;
}

export function deconcat(key) {
  return {
    key: parseInt(key.substr(0, 3)),
    n: parseInt(key.substr(3, 3))
  };
}

function GCD(a, b) {
  if (b) {
    return GCD(b, a % b);
  } else {
    return Math.abs(a);
  }
}
