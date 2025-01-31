/// <reference path="./typings.d.ts" />
import { ethers } from "ethers";
import { BigNumber } from "ethers";
import { keccak_256 } from "js-sha3";
import { keccak_256 as sha3 } from "js-sha3";
import { Buffer as Buffer } from "buffer/";
import { EnsAbi, RegistrarAbi, ResolverAbi, ETHRegistrarControllerAbi } from "./contracts";
import { default as domainChecker } from "is-valid-domain";
/** 用于服务器的 token */
let serverJwtToken = null;
/** 做一些检查 */
let getJwtToken = () => {
    if (serverJwtToken != null) {
        return serverJwtToken;
    }
    else {
        console.error("token 为空, 需要先登录获取 token");
        return null;
    }
};
export function getNamehash(name) {
    let node = "";
    for (let i = 0; i < 32; i++) {
        node += "00";
    }
    if (name) {
        let labels = name.split(".");
        for (let i = labels.length - 1; i >= 0; i--) {
            let labelSha = keccak_256(labels[i]);
            node = keccak_256(Buffer.from(node + labelSha, "hex"));
        }
    }
    return "0x" + node;
}
export function getLabelhash(rawlabel) {
    if (rawlabel === "[root]") {
        return "";
    }
    return rawlabel.startsWith("[") && rawlabel.endsWith("]") && rawlabel.length === 66 ? "0x" + decodeLabelhash(rawlabel) : "0x" + sha3(rawlabel);
}
export function encodeLabelhash(hash) {
    if (!hash.startsWith("0x")) {
        throw new Error("Expected label hash to start with 0x");
    }
    if (hash.length !== 66) {
        throw new Error("Expected label hash to have a length of 66");
    }
    return `[${hash.slice(2)}]`;
}
export function decodeLabelhash(hash) {
    if (!(hash.startsWith("[") && hash.endsWith("]") && hash.length === 66)) {
        throw Error("Expected encoded labelhash to start and end with square brackets");
    }
    return `${hash.slice(1, -1)}`;
}
export const stripHexPrefix = (str) => {
    return str.slice(0, 2) === "0x" ? str.slice(2) : str;
};
function checksummedHexDecoder(data) {
    const stripped = stripHexPrefix(data);
    return Buffer.from(stripHexPrefix(stripped), "hex");
}
export const toChecksumAddress = (address) => {
    if (typeof address !== "string") {
        throw new Error("stripHexPrefix param must be type 'string', is currently type " + typeof address + ".");
    }
    const strip_address = stripHexPrefix(address).toLowerCase();
    const keccak_hash = keccak_256(strip_address).toString();
    // const keccak_hash = keccak_256(strip_address).toString('hex')
    let output = "0x";
    for (let i = 0; i < strip_address.length; i++)
        output += parseInt(keccak_hash[i], 16) >= 8 ? strip_address[i].toUpperCase() : strip_address[i];
    return output;
};
function getBufferedPrice(price) {
    return BigNumber.from(price).mul(1);
}
const emptyAddress = "0x0000000000000000000000000000000000000000";
const emptyNode = "0x0000000000000000000000000000000000000000000000000000000000000000";
const resolverLabel = "0x" + sha3("resolver");
const resolverNode = getNamehash("resolver");
const nonode = "0x0000000000000000000000000000000000000000000000000000000000001234";
const tld = "dot";
const DAYS = 24 * 60 * 60;
const secret = "0x0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF0123456789ABCDEF";
const INFURA_URL = "https://rinkeby.infura.io/v3/75e0d27975114086be0463cf2597549e";
const api_url_base = "https://pns-engine.vercel.app/api/handler";
// const api_url_base = "http://localhost:5000/api/handler";
let provider;
/** TODO, extracted from JsonRpcSigner */
let signer;
let account;
/** TODO from contract */
let ens;
/** TODO from contract */
let resolver;
/** TODO from contract */
let registrar;
/** TODO from contract */
let controller;
let ensAddr;
let resolverAddr;
// // rinkeby
// export const ContractAddrs = {
//   ens: "0x0bE1570A673620fd445F58A4E6741ff0Fa927431",
//   resolver: "0x304f01BbcBc7cE9Ab0d7Dc747F911B1e47C687e8",
//   registrar: "0x0A7D1f2c94420Cbc6C19AF56dc0510E9e8Ea042F",
//   controller: "0x69327224Df3181963574Ea0b72306453B330feE8",
// };
// ens deployed to: 0x64f58DaBFbAa801F247429656cD37d16231890De
// resolver deployed to: 0x9a1006d456F9C7a5Ab2208E0f7e9DF9A438F7f73
// registrar deployed to: 0x938ce6808Fb2636F124A6da682666456fD9e656F
// dummyOracle deployed to: 0x17Cf83bBCE053c264626cD46FE312368f0433127
// stablePriceOracle deployed to: 0x01Eee6B2DC48810488B781F1Cdf0b4b2D73f2C1B
// controller deployed to: 0x511dB9C9f455a0aeb1f4E87de8ad8e87256253eE
// // moonbeam
// export const ContractAddrs = {
//   ens: "0x64f58DaBFbAa801F247429656cD37d16231890De",
//   resolver: "0x9a1006d456F9C7a5Ab2208E0f7e9DF9A438F7f73",
//   registrar: "0x938ce6808Fb2636F124A6da682666456fD9e656F",
//   controller: "0x511dB9C9f455a0aeb1f4E87de8ad8e87256253eE",
// };
// ens deployed to: 0x1C8B199E611446f6c75308c97400539fB79E8688
// resolver deployed to: 0x1C367639148168E472F2BCB57ABB43EaA3Cbe031
// registrar deployed to: 0xf8b31aD8eF5cE95F60C5EDB8b163048DAaBCaCCC
// dummyOracle deployed to: 0xbF670e06cBC959b073E42BEbA3c4a0AF296d6d2B
// stablePriceOracle deployed to: 0xf647104dba724279b4c02DeA547F925eFdFa99b0
// controller deployed to: 0x7dCb34e3617E88BD830F4C030B06201a69657173
// moonbeam dot
export const ContractAddrs = {
    ens: "0x1C8B199E611446f6c75308c97400539fB79E8688",
    resolver: "0x1C367639148168E472F2BCB57ABB43EaA3Cbe031",
    registrar: "0xf8b31aD8eF5cE95F60C5EDB8b163048DAaBCaCCC",
    controller: "0x7dCb34e3617E88BD830F4C030B06201a69657173",
};
const isNode = new Function("try {return this===global;}catch(e){return false;}");
export async function setProvider() {
    if (provider && account)
        return;
    if (typeof window.ethereum !== "undefined") {
        // 调用窗口, 登录账户
        await window.ethereum.request({ method: "eth_requestAccounts" });
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = await provider.getSigner();
        account = await signer.getAddress();
    }
    else {
        console.log("cannot find a global `ethereum` object");
        provider = new ethers.providers.JsonRpcProvider(INFURA_URL);
        signer = null;
        account = "0x0";
    }
    // console.log(provider, signer, account);
    // console.log("network", await provider.getNetwork());
    return;
}
/** 设置ens并初始化 */
export async function setup(ensAddress, resolverAddress, registrarAddress, controllerAddress) {
    if (provider && ens) {
        return {
            provider,
            signer,
            ens,
            resolver,
            registrar,
            controller,
        };
    }
    await setProvider();
    console.log("init sdk");
    ensAddress = ensAddress || ContractAddrs.ens;
    resolverAddress = resolverAddress || ContractAddrs.resolver;
    registrarAddress = registrarAddress || ContractAddrs.registrar;
    controllerAddress = controllerAddress || ContractAddrs.controller;
    if (signer) {
        ens = new ethers.Contract(ensAddress, EnsAbi, signer);
        resolver = new ethers.Contract(resolverAddress, ResolverAbi, signer);
        registrar = new ethers.Contract(registrarAddress, RegistrarAbi, signer);
        controller = new ethers.Contract(controllerAddress, ETHRegistrarControllerAbi, signer);
    }
    else {
        ens = new ethers.Contract(ensAddress, EnsAbi, provider);
        resolver = new ethers.Contract(resolverAddress, ResolverAbi, provider);
        registrar = new ethers.Contract(registrarAddress, RegistrarAbi, provider);
        controller = new ethers.Contract(controllerAddress, ETHRegistrarControllerAbi, provider);
    }
    ensAddr = ensAddress;
    resolverAddr = resolverAddress;
    return {
        provider,
        signer,
        ens,
        resolver,
        registrar,
        controller,
    };
}
export function getTld() {
    return "dot";
}
export function suffixTld(label) {
    return label.replace(".dot", "") + ".dot";
}
export function getProvider() {
    return provider;
}
export function getSigner() {
    return signer;
}
export function getAccount() {
    return account;
}
/** 获取域名的当前所有者 */
export async function getOwner(name) {
    await setup();
    let namehash = getNamehash(name);
    return ens.owner(namehash);
}
/** 获取域名的解析器合约 */
export function getResolver(name) {
    let namehash = getNamehash(name);
    return ens.resolver(namehash);
}
/** 获取域名的解析地址 */
export async function getAddr(name, key) {
    const namehash = getNamehash(name);
    // const resolverAddr = await ensContract.resolver(namehash)
    try {
        let coinTypes = {
            BTC: 0,
            ETH: 60,
            DOT: 354,
            KSM: 434,
        };
        let coinType = coinTypes[key];
        const addr = await resolver["addr(bytes32,uint256)"](namehash, coinType);
        if (addr === "0x")
            return emptyAddress;
        // return encoder(Buffer.from(addr.slice(2), 'hex'))
        return addr;
    }
    catch (e) {
        console.log(e);
        console.warn("Error getting addr on the resolver contract, are you sure the resolver address is a resolver contract?");
        return emptyAddress;
    }
}
/** 设置域名的解析地址 */
export async function setAddr(name, key, value) {
    const namehash = getNamehash(name);
    // const resolverAddr = await ensContract.resolver(namehash)
    try {
        let coinTypes = {
            BTC: 0,
            ETH: 60,
            DOT: 354,
            KSM: 434,
        };
        let coinType = coinTypes[key];
        const addr = await resolver["setAddr(bytes32,uint256,bytes)"](namehash, coinType, value);
        if (addr === "0x")
            return emptyAddress;
        // return encoder(Buffer.from(addr.slice(2), 'hex'))
        return addr;
    }
    catch (e) {
        console.log(e);
        console.warn("Error getting addr on the resolver contract, are you sure the resolver address is a resolver contract?");
        return emptyAddress;
    }
}
/** 获得 MinimumCommitmentAge 参数，即注册的第一步到第二步之间的最小时间间隔 */
export function getMinimumCommitmentAge(controller) {
    return controller.minCommitmentAge();
}
/** 获得 getMaximumCommitmentAge 参数，即注册的第一步到第二步之间的最大时间间隔 */
export function getMaximumCommitmentAge(controller) {
    return controller.maxCommitmentAge();
}
/** 获得当前域名注册价格
 * function getRentPrice(string name, uint duration) returns (uint)
 * getRentPrice('hero', 86400*365) */
export async function getRentPrice(name, duration) {
    await setup();
    let result = await controller.rentPrice(name, duration);
    let price = result.toNumber();
    return price;
}
/** 同上, 但返回一个 BigNumber, 内部需要 */
export async function getRentPriceBigNumber(name, duration) {
    await setup();
    let result = await controller.rentPrice(name, duration);
    return result;
}
/** 批量获得当前域名注册价格 */
export async function getRentPrices(labels, duration) {
    const pricesArray = await Promise.all(labels.map((label) => {
        return getRentPrice(label, duration);
    }));
    return pricesArray.reduce((a, c) => a.add(c));
}
export async function getMinCommitmentAge() {
    return controller.minCommitmentAge();
}
/** 计算commitment */
export async function makeCommitment(label, account) {
    let secret = getNamehash("dot"); // todo: store user
    if (parseInt(resolverAddr, 16) === 0) {
        return controller.makeCommitment(label, account, secret);
    }
    else {
        return controller.makeCommitmentWithConfig(label, account, secret, resolverAddr, account);
    }
}
/** 检查是否已经提交commitment */
export async function checkCommitment(account, label) {
    const commitment = await makeCommitment(label, account);
    return controller.commitments(commitment);
}
/** 开始注册域名（第一步），这一步是提交commitment */
export async function commit(label, account) {
    const commitment = await makeCommitment(label, account);
    return controller.commit(commitment);
}
/** 域名注册（第二步），完成域名注册 */
export async function register(label, account, duration) {
    const price = await getRentPriceBigNumber(label, duration);
    const priceWithBuffer = getBufferedPrice(price);
    // const resolverAddr = await getowner("resolver.dot");
    let secret = getNamehash("dot");
    return controller.registerWithConfig(label, account, duration, secret, resolverAddr, account, { value: price.toNumber() * 100, gasLimit: 500000 });
}
export async function expiriesAt(label) {
    label = "0x" + sha3(label) || "0x0";
    return registrar.nameExpires(label);
}
export async function available(label) {
    label = "0x" + sha3(label) || "0x0";
    return registrar.available(label);
}
export async function renew(label, duration) {
    const price = await getRentPriceBigNumber(label, duration);
    const priceWithBuffer = getBufferedPrice(price);
    return controller.renew(label, duration, { value: priceWithBuffer, gasLimit: 500000 });
}
export function decodeContenthash(encoded) {
    let decoded, protocolType, error;
    if (!encoded || encoded === "0x") {
        return {};
    }
    if (encoded) {
        try {
            // decoded = contentHash.decode(encoded) // todo
            // const codec = contentHash.getCodec(encoded)
            decoded = encoded;
        }
        catch (e) {
            error = e.message;
        }
    }
    return { protocolType: "ipfs", decoded, error };
}
/** 获得域名的IPFS内容地址 */
export async function getContent(name) {
    try {
        const namehash = getNamehash(name);
        const encoded = await resolver.contenthash(namehash);
        return {
            value: `ipfs://${ethers.utils.base58.encode(encoded)}`,
            contentType: "contenthash",
        };
    }
    catch (e) {
        const message = "Error getting content on the resolver contract, are you sure the resolver address is a resolver contract?";
        console.warn(message, e);
        return { value: "", contentType: "error" };
    }
}
function buildKeyValueObjects(keys, values) {
    return values.map((record, i) => ({
        key: keys[i],
        value: record,
    }));
}
/** 获得域名详细信息 */
export async function getDomainDetails(name) {
    const nameArray = name.split(".");
    const labelhash = getLabelhash(nameArray[0]);
    const nameResolver = await getResolver(name);
    const owner = await getOwner(name);
    const TEXT_RECORD_KEYS = ["email", "url", "avatar", "description", "notice", "keywords", "com.twitter", "com.github"];
    const promises = TEXT_RECORD_KEYS.map((key) => getText(name, key));
    const records = await Promise.all(promises);
    let textRecords = buildKeyValueObjects(TEXT_RECORD_KEYS, records);
    const node = {
        name,
        label: nameArray[0],
        labelhash,
        owner,
        nameResolver,
        textRecords,
    };
    const content = await getContent(node.name);
    return {
        ...node,
        addrs: [
            { key: "BTC", value: await getAddr(node.name, "BTC") },
            { key: "ETH", value: await getAddr(node.name, "ETH") },
            { key: "DOT", value: await getAddr(node.name, "DOT") },
            { key: "KSM", value: await getAddr(node.name, "KSM") },
        ],
        content: content.value,
        contentType: "ipfs",
    };
    // if (parseInt(nameResolver, 16) === 0) {
    //   return {
    //     ...node,
    //     addrs: [],
    //     content: null,
    //     contentType: null,
    //   };
    // } else {
    //   try {
    //     const content = await getContent(node.name);
    //     return {
    //       ...node,
    //       addrs: [
    //         { key: "BTC", value: await getAddr(node.name, "BTC") },
    //         { key: "ETH", value: await getAddr(node.name, "ETH") },
    //         { key: "DOT", value: await getAddr(node.name, "DOT") },
    //         { key: "KSM", value: await getAddr(node.name, "KSM") },
    //       ],
    //       content: content.value,
    //       contentType: "ipfs",
    //     };
    //   } catch (e) {
    //     return {
    //       ...node,
    //       addrs: [],
    //       content: "0x0",
    //       contentType: "error",
    //     };
    //   }
    // }
}
export async function setDomainDetails(name, textRecords, addrs, content) {
    await Promise.all(textRecords.map(async (item) => {
        if (item.value && item.value !== "") {
            await setText(name, item.key, item.value);
        }
    }));
    await Promise.all(addrs.map(async (item) => {
        if (item.value && item.value !== "") {
            await setAddr(name, item.key, item.value);
        }
    }));
    if (content && content !== "") {
        await setContent(name, content);
    }
}
/** 一次性设置域名信息
 * function setRecord(bytes32 name, address owner, address resolver, uint64 ttl)
 * setRecord('hero.eth', 'sub', '0x123456789', '0x123456789', 86400) */
export function setRecord(name, newOwner, resolver, ttl) {
    let namehash = getNamehash(name);
    return ens.setRecord(namehash, newOwner, resolver, ttl);
}
/** 一次性设置域名信息
 * function setSubnodeRecord(bytes32 name, bytes32 label, address owner, address resolver, uint64 ttl)
 * setSubnodeRecord('hero.eth', 'sub', '0x123456789', '0x123456789', 86400) */
export function setSubnodeRecord(name, label, newOwner, resolver, ttl) {
    let namehash = getNamehash(name);
    label = "0x" + sha3(label) || "0x0";
    return ens.setSubnodeRecord(namehash, label, newOwner, resolver, ttl);
}
/** 设置子域名的所有者
 * function setOwner(bytes32 name, address owner)
 * setOwner('hero.eth', '0x123456789') */
export function setOwner(name, newOwner) {
    let namehash = getNamehash(name);
    return ens.setOwner(namehash, newOwner);
}
/** 设置子域名的所有者
 * function setSubnodeOwner(bytes32 name, bytes32 label, address owner)
 * setSubnodeOwner('hero.eth', 'sub', '0x123456789') */
export function setSubnodeOwner(name, label, newOwner) {
    let namehash = getNamehash(name);
    label = "0x" + sha3(label) || "0x0";
    return ens.setSubnodeOwner(namehash, label, newOwner);
}
/** 设置域名 resolver 参数，表示域名的解析器
 * function setResolver(bytes32 name, address resolver)
 * setResolver('hero.eth', '0x123456789') */
export function setResolver(name, resolver) {
    let namehash = getNamehash(name);
    return ens.setResolver(namehash, resolver);
}
/** 设置域名的默认 resolver 参数，表示域名的解析器 */
export function setDefaultResolver(name) {
    let namehash = getNamehash(name);
    return ens.setResolver(namehash, resolverAddr);
}
/** 设置域名 ttl 参数，表示域名可以在本地缓存的时间
 * function setTTL(bytes32 name, uint64 ttl)
 * setTTL('hero.eth', 3600) */
export function setTTL(name, ttl) {
    let namehash = getNamehash(name);
    return ens.setTTL(namehash, ttl);
}
/** 获得域名 ttl 参数，由用户设置，表示域名可以在本地缓存的时间
 * function getTTL(bytes32 name) returns (uint64)
 * getTTL('hero.eth') */
export function getTTL(name) {
    let namehash = getNamehash(name);
    return ens.ttl(namehash);
}
/** 设置域名 ttl 参数，表示域名可以在本地缓存的时间
 * function setTTL(bytes32 name, uint64 ttl)
 * setTTL('hero.eth', 3600) */
export function setText(name, key, value) {
    let namehash = getNamehash(name);
    return resolver.setText(namehash, key, value);
}
/** 获得域名 ttl 参数，由用户设置，表示域名可以在本地缓存的时间
 * function getTTL(bytes32 name) returns (uint64)
 * getTTL('hero.eth') */
export function getText(name, key) {
    let namehash = getNamehash(name);
    return resolver.text(namehash, key);
}
/** 设置域名 ttl 参数，表示域名可以在本地缓存的时间
 * function setTTL(bytes32 name, uint64 ttl)
 * setTTL('hero.eth', 3600) */
export function setContent(name, value) {
    let namehash = getNamehash(name);
    console.log(resolver);
    return resolver.setContenthash(namehash, value);
}
// server api
/** 获取用户登录的签名token */
export async function signLoginMessage() {
    let signer = provider.getSigner();
    let content = "PNS Login";
    return signer.signMessage(content);
}
/** 通过用户登录的签名token登录 */
export async function getLoginToken(sig) {
    return fetch(api_url_base, {
        method: "POST",
        body: JSON.stringify({
            action: "login",
            sig: sig,
        }),
        headers: new Headers({
            "Content-Type": "application/json",
        }),
    }).then((res) => res.json());
}
export async function autoLogin() {
    console.log("auto login");
    if (!window.ethereum) {
        window.alert("Please install MetaMask first.");
        console.log("cannot find a global `ethereum` object");
        provider = new ethers.providers.JsonRpcProvider(INFURA_URL);
        signer = null;
        account = "0x0";
        return;
    }
    if (!provider) {
        try {
            let web3 = window.ethereum;
            await web3.enable();
            provider = new ethers.providers.Web3Provider(web3);
            signer = await provider.getSigner();
            account = await signer.getAddress();
        }
        catch (error) {
            window.alert("You need to allow MetaMask.");
            return;
        }
    }
    await setup();
    let hasLocalstorage = typeof window.localStorage !== "undefined";
    if (hasLocalstorage && localStorage.getItem("pns-jwt")) {
        console.log("jwt loaded");
        let jwt = localStorage.getItem("pns-jwt");
        // 在类库当中缓存 token
        serverJwtToken = jwt;
        return jwt;
    }
    else {
        let signed = await signLoginMessage();
        let { jwt } = await getLoginToken(signed);
        console.log("get new jwt");
        // 在类库当中缓存 token
        serverJwtToken = jwt;
        if (hasLocalstorage) {
            localStorage.setItem("pns-jwt", jwt);
        }
        return jwt;
    }
}
export async function tryLogin() {
    await setup();
    let hasLocalstorage = typeof window.localStorage !== "undefined";
    if (hasLocalstorage && localStorage.getItem("pns-jwt")) {
        console.log("jwt loaded");
        let jwt = localStorage.getItem("pns-jwt");
        // 在类库当中缓存 token
        console.info("jwtToken loaded");
        serverJwtToken = jwt;
        return jwt;
    }
    else {
        let signed = await signLoginMessage();
        let { jwt } = await getLoginToken(signed);
        console.log("get new jwt");
        // 在类库当中缓存 token
        console.info("jwtToken loaded");
        serverJwtToken = jwt;
        if (hasLocalstorage) {
            localStorage.setItem("pns-jwt", jwt);
        }
        return jwt;
    }
}
/** 列出用户关注的域名列表 */
export async function listFav(account) {
    return fetch(api_url_base, {
        method: "POST",
        body: JSON.stringify({
            action: "listFav",
            token: getJwtToken(),
            account: account,
        }),
        headers: new Headers({
            "Content-Type": "application/json",
        }),
    }).then((res) => res.json());
}
/** 创建用户关注的域名 */
export async function createFav(account, domain) {
    return fetch(api_url_base, {
        method: "POST",
        body: JSON.stringify({
            action: "createFav",
            token: getJwtToken(),
            account: account,
            domain: domain,
        }),
        headers: new Headers({
            "Content-Type": "application/json",
        }),
    }).then((res) => res.json());
}
/** 取消用户关注的域名 */
export async function deleteFav(id) {
    return fetch(api_url_base, {
        method: "POST",
        body: JSON.stringify({
            action: "deleteFav",
            token: getJwtToken(),
            ref: id,
        }),
        headers: new Headers({
            "Content-Type": "application/json",
        }),
    })
        .then((res) => res.json())
        .catch((err) => "err");
}
/** 列出用户的子域名列表 */
export async function listSubdomain(account) {
    return fetch(api_url_base, {
        method: "POST",
        body: JSON.stringify({
            action: "listSubdomain",
            token: getJwtToken(),
            account: account,
        }),
        headers: new Headers({
            "Content-Type": "application/json",
        }),
    }).then((res) => res.json());
}
/** 创建用户的子域名 */
export async function createSubdomain(account, domain, data) {
    return fetch(api_url_base, {
        method: "POST",
        body: JSON.stringify({
            action: "createSubdomain",
            token: getJwtToken(),
            account: account,
            domain: domain,
            data: data,
        }),
        headers: new Headers({
            "Content-Type": "application/json",
        }),
    }).then((res) => res.json());
}
/** 删除用户的子域名 */
export async function deleteSubdomain(id) {
    return fetch(api_url_base, {
        method: "POST",
        body: JSON.stringify({
            action: "deleteSubdomain",
            token: getJwtToken(),
            ref: id,
        }),
        headers: new Headers({
            "Content-Type": "application/json",
        }),
    }).then((res) => res.json());
}
/** 列出用户的域名列表 */
export async function listDomain(account) {
    return fetch(api_url_base, {
        method: "POST",
        body: JSON.stringify({
            action: "listDomain",
            token: getJwtToken(),
            account: account,
        }),
        headers: new Headers({
            "Content-Type": "application/json",
        }),
    }).then((res) => res.json());
}
/** 创建用户的域名 */
export async function createDomain(account, domain, data) {
    return fetch(api_url_base, {
        method: "POST",
        body: JSON.stringify({
            action: "createDomain",
            token: getJwtToken(),
            account: account,
            domain: domain,
            data: data,
        }),
        headers: new Headers({
            "Content-Type": "application/json",
        }),
    }).then((res) => res.json());
}
/** 删除用户的域名 */
export async function deleteDomain(id) {
    return fetch(api_url_base, {
        method: "POST",
        body: JSON.stringify({
            action: "deleteDomain",
            token: getJwtToken(),
            ref: id,
        }),
        headers: new Headers({
            "Content-Type": "application/json",
        }),
    }).then((res) => res.json());
}
export function matchProtocol(text) {
    return text.match(/^(ipfs|sia|ipns|bzz|onion|onion3):\/\/(.*)/) || text.match(/\/(ipfs)\/(.*)/) || text.match(/\/(ipns)\/(.*)/);
}
export function getProtocolType(encoded) {
    let protocolType, decoded;
    try {
        let matched = matchProtocol(encoded);
        if (matched) {
            protocolType = matched[1];
            decoded = matched[2];
        }
        return {
            protocolType,
            decoded,
        };
    }
    catch (e) {
        console.log(e);
    }
}
/** 解析IPFS地址 */
export function decodeIpfsUrl(url) {
    let data = getProtocolType(url);
    return "0x" + Buffer.from(ethers.utils.base58.decode(data.decoded)).toString("hex");
}
/** 目前使用的都都是基于 eth 的域名, 后续扩展再拆分函数 */
export function isValidDomain(rawName) {
    let name = rawName.endsWith("." + tld) ? rawName : `${rawName}.${tld}`;
    return name.length < 64 && domainChecker(name, { allowUnicode: false, subdomain: false });
}
//# sourceMappingURL=sdk.js.map