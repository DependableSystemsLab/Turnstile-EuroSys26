const fs = require('fs');
const crypto = require('crypto');
const { Module } = require('module');

const PRIMITIVE_TYPES = ['boolean', 'number', 'string'];
const REFERENCE_TYPES = ['function', 'object'];
const NATIVE_TYPES = [ Date, Promise, Buffer, Map ];
const PROPERTY_PREFIX = 'φ';       // prefix for injected properties holding tracker metadata
const CONTAINER_PROPERTY = Symbol(PROPERTY_PREFIX + 'container');
const DEBUG_ID_PROPERTY = Symbol('debug_id');
const LABEL_PROPERTY = PROPERTY_PREFIX + 'label';

const DATE_INTERNAL_FUNCS = [ 'getDate', 'toJSON', 'valueOf', 'toISOString' ];
const DATE_INTERNAL_PROPS = [];

const BUFFER_INTERNAL_FUNCS = [ 'toString' ];
const BUFFER_INTERNAL_PROPS = [ 'length', 'buffer' ];

const PROMISE_INTERNAL_FUNCS = [ 'then' ];

const MAP_INTERNAL_FUNCS = [ 'get', 'set', 'clear' ];

const BUILTIN_SINKS = [
    fs.readFileSync,
    fs.readFile,
    fs.appendFileSync,
    fs.appendFile
];

let PRINT_LOGS = false;

const TrackerMap = new Map();
const OriginalToSerializedMap = new Map(); // original -> serialized
const SerializedToOriginalMap = new Map(); // serialized -> original

function serializeLabel(label){
    return label instanceof Set ? Array.from(label) : (label instanceof PrimitiveObject ? label.value : label);
}

function serializeObject(obj){
    if (OriginalToSerializedMap.has(obj)){
        return OriginalToSerializedMap.get(obj);
    }

    let result;
    if (obj instanceof PrimitiveObject){
        result = obj.value;
        // sMap.set(obj, result);
    }
    else if (obj instanceof Array){
        result = obj.map(item => serializeObject(item));
        OriginalToSerializedMap.set(obj, result);
        SerializedToOriginalMap.set(result, obj);
    }
    else if (obj instanceof Buffer || obj instanceof Date || obj instanceof Map || obj instanceof Set || obj instanceof Promise){
        result = obj;
        OriginalToSerializedMap.set(obj, obj);
        SerializedToOriginalMap.set(obj, obj);
    }
    else if (obj !== null && typeof obj === 'object'){
        const serialized = Object.create(Object.getPrototypeOf(obj));
        OriginalToSerializedMap.set(obj, serialized);
        SerializedToOriginalMap.set(serialized, obj);
        Object.keys(obj).forEach(key => {
            serialized[key] = serializeObject(obj[key]);
        });
        result = serialized;
    }
    else {
        result = obj;
    }
    
    return result;
}

function identityPreservingDeepCopy(serialized, cSet, level = 0){
    let indent = Array.from({ length: level }).map(item => '  ').join('');
    if (!SerializedToOriginalMap.has(serialized)){
        return serialized;
    }

    if (!cSet){
        cSet = new Set();
    }

    let result = SerializedToOriginalMap.get(serialized);

    if (cSet.has(result)){
        return result;
    }

    cSet.add(result);

    if (serialized instanceof Array){
        let lenDiff = serialized.length - result.length;
        if (lenDiff > 0){
            result.splice(result.length, 0, Array.from({ length: lenDiff }));
        }
        else if (lenDiff < 0){
            result.splice(result.length + lenDiff, Math.abs(lenDiff));
        }
        for (let i = 0; i < serialized.length; i ++){
            const child = identityPreservingDeepCopy(serialized[i], cSet, level + 1);
            if (result[i] !== child){
                result[i] = child;
            }
            // result[i] = identityPreservingDeepCopy(serialized[i], dMap, cSet, level + 1);
        }
    }
    else if (serialized instanceof Buffer || serialized instanceof Date || serialized instanceof Map || serialized instanceof Set || serialized instanceof Promise){
        // buffer, map objects are not serialized at all
        // (they use internal slots and serializing them causes issues during reflection)
        return result;
    }
    else if (typeof serialized === 'object'){
        Object.keys(result)
            .filter(key => !(key in serialized))
            .forEach(key => {
                delete result[key];
            });

        for (let key in serialized){
            if (key in result){
                if (result[key] instanceof PrimitiveObject && PRIMITIVE_TYPES.includes(serialized[key])){
                    result[key].value = serialized[key];
                }
                else {
                    // console.log(indent + key);
                    const child = identityPreservingDeepCopy(serialized[key], cSet, level + 1);
                    if (result[key] !== child){
                        result[key] = child;
                    }
                    // result[key] = identityPreservingDeepCopy(serialized[key], dMap, cSet, level + 1);
                }
            }
            else {
                result[key] = identityPreservingDeepCopy(serialized[key], cSet, level + 1);
            }
        }
    }

    return result;
}

// Override built in objects so that they can work with PrimitiveObjects
const originalArrayIndexOf = Array.prototype.indexOf;
Array.prototype.indexOf = function(item){
    item = item instanceof PrimitiveObject ? item.value : item;
    for (let i = 0; i < this.length; i ++){
        if ((this[i] instanceof PrimitiveObject && item === this[i].value)
            || item === this[i]){
            return i;
        }
    }
    return -1;
};

// We need to turn primitive values into objects
// so that each primitive is uniquely identifiable by reference
class PrimitiveObject {
    constructor(value, container = null){
        this.value = value;
        this[CONTAINER_PROPERTY] = container;
        this[DEBUG_ID_PROPERTY] = crypto.randomBytes(4).toString('hex');
    }

    setContainer(container){
        this[CONTAINER_PROPERTY] = container;
    }

    get type(){
        return typeof this.value;
    }

    // need to override toString so that
    // when the value is used as the property accessor,
    // it is casted to the correct key
    // e.g., foo[PrimitiveObject(4)] should be cast to foo[4]
    //       foo[PrimitiveObject("bar")] should be cast to foo["bar"]
    toString(){
        return typeof this.value === 'number' ? this.value : String(this.value);
    }

    toJSON(){
        return this.value;
    }

    valueOf(){
        return this.value.valueOf();
    }

    // called by the user application if the value is a string
    // TODO:
    //   * inherit label
    //   * define different subclasses of PrimitiveObject
    //     such that each subclass represents a primitive type
    //     and has the corresponding methods
    //     -- there are several functions
    split(arg){
        return this.value.split(arg);
    }

    replace(...args){
        return this.value.replace.apply(this.value, args);
    }

    trim(){
        return this.value.trim();
    }

    match(...args){
        return this.value.match.apply(this.value, args);
    }

    startsWith(char){
        return this.value.startsWith(char);
    }

    endsWith(char){
        return this.value.endsWith(char);
    }

    toUpperCase(){
        return this.value.toUpperCase();
    }

    toLowerCase(){
        return this.value.toLowerCase();
    }

    static binaryOp(operator, left, right){
        switch (operator){
            case "+":
                return new PrimitiveObject(left.value + right.value);
            case "-":
                return new PrimitiveObject(left.value - right.value);
            case "*":
                return new PrimitiveObject(left.value * right.value);
            case "/":
                return new PrimitiveObject(left.value / right.value);
            case "===":
                return new PrimitiveObject(left.value === right.value);
            default:
                throw new Error(`The operator '${operator}' is currently not supported`);
        }
    }
}

const ProxyMap = new Map();
const ProxyReverseMap = new Map();
function proxify(target, container = null, level = 0){
    // const indent = Array.from({ length: level }).map(i => '    ').join('');

    if (target === null || target === undefined){
        return target;
    }

    if (ProxyMap.has(target)){
        return ProxyMap.get(target);
    }
    else if (PRIMITIVE_TYPES.includes(typeof target)){
        // console.log('Creating PrimitiveObject for ' + Object.getPrototypeOf(target).constructor.name + ' ' + target);
        return new PrimitiveObject(target, container);
    }
    else if (NATIVE_TYPES.includes(target.constructor)){
        return target;
    }
    else if (target instanceof PrimitiveObject){
        // target.setContainer(container);
        return target;
    }

    const targetPrototype = Object.getPrototypeOf(target);
    const isPlainObject = (Object.getPrototypeOf(target) === Object.prototype);
    const isArray = target instanceof Array;
    const isFunction = (Object.getPrototypeOf(target) === Function.prototype);
    const hasNullPrototype = (Object.getPrototypeOf(target) === null);
    const protoPropertyNames = hasNullPrototype ? [] : Object.getOwnPropertyNames(targetPrototype);
    const ownPropertyNames = Object.getOwnPropertyNames(target).filter(key => !(key === 'prototype' && isFunction) && !(key === 'constructor' && hasNullPrototype));

    const proxyHandler = {
        get (obj, prop, receiver){
            if (prop === CONTAINER_PROPERTY) return container;
            if (prop === LABEL_PROPERTY) return Reflect.get(obj, prop, receiver);

            const propVal = Reflect.get(obj, prop, receiver);

            if ((isPlainObject || isArray) && !protoPropertyNames.includes(prop) && typeof prop !== 'symbol'){
                // console.log(indent + 'lazily proxifying prop ', prop);
                const propProxy = proxify(propVal, proxy, level + 1);
                if (propProxy instanceof PrimitiveObject){
                    Reflect.set(obj, prop, propProxy, receiver);
                    // console.log(indent + 'created primitive object ' + propProxy[DEBUG_ID_PROPERTY]);
                }
                return propProxy;
            }

            return propVal;
        },
        set (obj, prop, val, receiver){
            // console.log('Setting ' + prop + ' with ' + val);

            if (val instanceof PrimitiveObject){
                // TODO: check if val already has a label
                val.setContainer(proxy);
            }

            if (ProxyReverseMap.has(val)){
                return Reflect.set(obj, prop, ProxyReverseMap.get(val), receiver);
            }
            else {
                return Reflect.set(obj, prop, val, receiver);    
            }

            // return proxifyProp(prop, val);
        }
    }

    const proxy = new Proxy(target, proxyHandler);
    ProxyMap.set(target, proxy);
    ProxyReverseMap.set(proxy, target);

    return proxy;
}

class SecurityViolation extends Error {
    constructor(message, source, sink){
        super(message);
        this.name = 'SecurityViolation';
        this.source = source;
        this.sink = sink;
    }
}

class Tracker {
    constructor(initializedInFilePath, local_module) {
        this.filePath = initializedInFilePath;
        this.module = local_module;

        this.labelMap = new Map(); // including both sources and combined labels
        
        this.labelInjectors = null;
        this.rules = null;
        this.readGraph = { nodes: {}, edges: [] };
        this.writeGraph = { nodes: {}, edges: [] };
        this.compareCache = { read: {}, write: {} };

        this.checkCount = 0;

        TrackerMap.set(this.filePath, this);
    }

    parseRuleExpression(line) {
        const regex = /\s*(\*|\w+)\s*(-\>|-\/\>|\<-|\<\/-)\s*(\*|\w+)\s*/;
        const match = line.match(regex);

        if (match){
            const left = match[1];
            const op = match[2];
            const right = match[3];

            switch (op){
                case '->':
                    return { type: 'allow', domain: 'write', source: left, sink: right };
                case '-/>':
                    return { type: 'disallow', domain: 'write', source: left, sink: right };
                case '<-':
                    return { type: 'allow', domain: 'read', source: right, sink: left };
                case '</-':
                    return { type: 'disallow', domain: 'read', source: right, sink: left };
            }
        }
        else throw new Error(`"${line}" is not a valid Rule Expression`)
    }

    parseRules(ruleExpressions){
        return ruleExpressions.map(line => this.parseRuleExpression(line));
    }

    configure(policy) {
        this.labelInjectors = policy.labellers;
        this.labelIssuers = policy.issuers;
        this.rules = this.parseRules(policy.rules);

        this.rules.forEach(rule => {
            const graph = rule.domain === 'write' ? this.writeGraph : this.readGraph;

            if (rule.type === 'disallow') return;

            if (!graph.nodes[rule.source]){
                graph.nodes[rule.source] = { name: rule.source,  incoming: [], outgoing: [], paths: {} };
            }

            if (!graph.nodes[rule.sink]){
                graph.nodes[rule.sink] = { name: rule.sink, incoming: [], outgoing: [], paths: {} };
            }

            let existingEdge = graph.edges.find(edge => edge.source === rule.source && edge.sink === rule.sink);

            if (existingEdge){
                console.error(`WARN: Rule [${rule.type} ${rule.domain} from ${rule.source} to ${rule.sink}] already defined. Ignoring duplicate rule.`);
            }
            else {
                graph.edges.push({ source: rule.source, sink: rule.sink });
                if (!graph.nodes[rule.source].outgoing.includes(rule.sink)){
                    graph.nodes[rule.source].outgoing.push(rule.sink);
                }
                if (!graph.nodes[rule.sink].incoming.includes(rule.source)){
                    graph.nodes[rule.sink].incoming.push(rule.source);
                }
            }
        });

        // after the graph is constructed, perform topological sort
        // to make it easy to compare labels later
        const frontier = Object.values(this.writeGraph.nodes).filter(item => !item.prev);
        // frontier.forEach(item => { item.level = 0 });
        
        while (frontier.length > 0){
            const node = frontier.shift();
            for (let label of node.outgoing){
                const newPathName = node.name + '-' + label;
                const next = this.writeGraph.nodes[label];

                Object.keys(node.paths).forEach(pathName => {
                    if (node.paths[pathName] !== 0 && (!next.paths[pathName] || next.paths[pathName] <= node.paths[pathName])){
                        next.paths[pathName] = node.paths[pathName] + 1;
                    }
                });

                node.paths[newPathName] = 0;
                next.paths[newPathName] = 1;

                if (!frontier.includes(next)){
                    frontier.push(next);
                }
            }
        }

        // this.printRules();
        // console.log(this.writeGraph);
        // console.log(this.readGraph);

        // const nodes = Object.values(this.writeGraph.nodes);
        // for (let i = 0; i < nodes.length; i ++){
        //     for (let j = 0; j < nodes.length; j++){
        //         console.log(nodes[i].name, nodes[j].name, this._compareLabels('write', nodes[i].name, nodes[j].name));
        //     }
        // }
    };

    require(modulePath) {
        let mod = this.module.require(modulePath);

        if (typeof mod === 'function') {
            BUILTIN_SINKS.push(mod);
        }
        else if (typeof mod === 'object' && mod !== null){
            Object.values(mod).forEach(prop => {
                if (typeof prop === 'function'){
                    BUILTIN_SINKS.push(prop);
                }
            });
        }

        return mod;
    }

    // assign label on the given obj using the labeller provided
    label(obj, labellerId, labellerFunc = null) {
        var labeller = null; 
        var labellerFuncProvided = false;
        
        if (labellerFunc) {
            console.log("label function provided");
            if (typeof (labellerFunc.func) != 'function') {
                throw new Error(`Invalid labeller fucntion is provided of type ${typeof (labellerFunc)}`);
            }
            labeller = labellerFunc.func;
            labellerFuncProvided = true;
        } else {
            labeller = this.labelInjectors[labellerId];
        }
        const proxy = proxify(obj);

        if (labeller instanceof Function){
            let label ;

            if (labellerFuncProvided) {
                const moduleObjects = {};
                // check the modules
                if (labellerFunc.modules && labellerFunc.modules.length > 0) {
                    labellerFunc.modules.forEach(key => {
                        moduleObjects[key] = require(key);
                    });
                }

                // calling the label function with the arg_array passed 
                labellerFunc.args.push(moduleObjects);
                // NOTE: make sure that the labeller function is syncronous! 
                label = labeller(...labellerFunc.args);
            } else {
                label = labeller(obj);
            } 
            if (label instanceof PrimitiveObject){
                label = label.value;
            }
            this.labelMap.set(proxy, label);
            proxy[LABEL_PROPERTY] = serializeLabel(label);
        }
        else if (labeller.type === 'map'){
            obj.forEach((item, index, list) => {
                // console.log('    Proxifying child item ' + index);
                const propProxy = proxify(item);
                let propLabel = labeller.injector(item);
                if (propLabel instanceof PrimitiveObject){
                    propLabel = propLabel.value;
                }
                // console.log('    Assigning label ' + (Object.getPrototypeOf(propLabel).constructor.name) + ' ' + propLabel + ' to ' + propProxy);
                this.labelMap.set(propProxy, propLabel);
                propProxy[LABEL_PROPERTY] = serializeLabel(propLabel);
                list[index] = propProxy;
                if (propProxy instanceof PrimitiveObject){
                    // console.log('   primitive object ' + propProxy[DEBUG_ID_PROPERTY]);
                }
            });
        }
        else if (labeller.invoke instanceof Function){
            // if (!(obj instanceof Function)){
            //     throw new Error(`Label injector ${labellerId} is of type "invoke", but the target object is not a function`);
            // }

            this.labelMap.set(proxy, labeller.invoke);
            proxy[LABEL_PROPERTY] = labeller.invoke;
        }
        else if (labeller.labelOf instanceof Function){
            const labelOf = (obj, args, func, circularTracker) => this._getLabel(labeller.labelOf(proxy), { object: obj, func: func, args: args }, circularTracker);
            this.labelMap.set(proxy, labelOf);
            proxy[LABEL_PROPERTY] = labelOf;
        }
        else {
            throw new Error(`Invalid label injector provided for ${obj}`);
        }

        return proxy;
    };

    _getLabel(obj, context = null, circularTracker = null){
        if (obj === null || obj === undefined || PRIMITIVE_TYPES.includes(typeof obj) || obj instanceof Module) return;

        // console.log(`Getting label of [${Object.getPrototypeOf(obj).constructor.name}] "${String(obj)}"`);

        if (!circularTracker){
            circularTracker = new Map();
        }

        if (circularTracker.has(obj)){
            return circularTracker.get(obj);
        }
        else {
            circularTracker.set(obj, null);
        }

        // retrieve the labels
        let obj_label = this.labelMap.get(obj);
        if (!obj_label) {
            // console.log(`...label map does not have "${String(obj)}"`);
            if (obj && obj[LABEL_PROPERTY]){
                obj_label = obj[LABEL_PROPERTY];
            }
            else if (obj && obj[CONTAINER_PROPERTY]){
                // console.log(`...looking for the container of "${String(obj)}"`, obj[CONTAINER_PROPERTY]);
                obj_label = this.labelMap.get(obj[CONTAINER_PROPERTY]);
            }
            else if (typeof obj === 'object' && !(obj instanceof Buffer)){
                // try to combine labels of children
                obj_label = this._combineLabels(...Object.values(obj).map(child => this._getLabel(child, context, circularTracker)));

                // const argLabels = Object.keys(obj).map(key => {
                //     const childLabel = this._getLabel(obj[key], context, circularTracker)
                //     console.log(key, childLabel);
                //     return childLabel;
                // });
                // obj_label = this._combineLabels(...argLabels);
            }
        }

        if (obj_label instanceof Function){
            const contextObject = context ? context.object : null;
            const contextArgs = context ? context.args : null;
            const contextFunc = context ? context.func : null;

            obj_label = obj_label(contextObject, contextArgs, contextFunc, circularTracker);
            if (obj_label instanceof PrimitiveObject){
                obj_label = obj_label.value;
            }
        }

        circularTracker.set(obj, obj_label);
        return obj_label;
    }

    _setLabel(obj, label){
        const proxy = proxify(obj);
        this.labelMap.set(proxy, label);
        proxy[LABEL_PROPERTY] = serializeLabel(label);
        return proxy;
    }

    // helper function to combine labels
    _combineLabels(...args){
        return args.reduce((combined, label) => {
            if (label instanceof Set){
                label.forEach(item => combined.add(item));
            }
            else if (label instanceof Array){
                // added here for robustness, but
                // labels should not be passed as arrays in the first place.
                // If a label is passed as an array, that means
                // there is some issue while serializing/deserializing objects
                label.forEach(item => combined.add(item));
            }
            else if (typeof label === 'string'){
                combined.add(label);
            }
            else if (typeof label === 'undefined' || label === null){
                // skip
            }
            else {
                throw new Error(`A label must be a string or a Set, but received ${label} (type ${Object.getPrototypeOf(label).constructor.name})`);
            }
            
            return combined;
        }, new Set());
    }

    _compareLabels(domain, label_A, label_B){
        // console.log(label_A, label_B);
        if (label_A === label_B) return 0;

        const queryKey = label_A + '-' + label_B;
        if (this.compareCache[queryKey]){
            return this.compareCache[queryKey];
        }

        const graph = this[domain + 'Graph'];

        const node_A = graph.nodes[label_A];
        const node_B = graph.nodes[label_B];

        if (!node_A || !node_B) return (this.compareCache[queryKey] = null);

        // console.log(label_A, label_B);

        if (node_A.outgoing.includes(node_B.name)){
            this.compareCache[queryKey] = 1;
            return 1;
        }
        else if (node_A.incoming.includes(node_B.name)){
            this.compareCache[queryKey] = -1;
            return -1;
        }

        const [ smaller, larger ] = Object.keys(node_A.paths).length < Object.keys(node_B.paths).length ? [ node_A.paths, node_B.paths ] : [ node_B.paths, node_A.paths ];

        const removed = Object.keys(smaller).filter(key => !(key in larger) && smaller[key] !== 0);

        if (removed.length === 0){
            // console.log(node_A.paths, node_B.paths);
            let minDistance;
            const pathKeys = Object.keys(smaller);

            for (let pathKey of pathKeys){
                let distance = larger[pathKey] - smaller[pathKey];
                if (isNaN(distance) && smaller[pathKey] !== 0) return null;

                if (!minDistance || Math.abs(distance) < Math.abs(minDistance)){
                    minDistance = distance;
                }
            }

            if (isNaN(minDistance)) return null;

            if (smaller === node_A.paths){
                return (this.compareCache[queryKey] = minDistance);
            }
            else {
                return (this.compareCache[queryKey] = -minDistance);
            }
        }
        else {
            return (this.compareCache[queryKey] = null);
        }
    }

    _extractHighestLabel(label){
        // Sometimes "label instanceof Array" return false despite label being an array (because of different contexts)
        if (label instanceof Set || label instanceof Array || Array.isArray(label)){
            return Array.from(label).sort((a, b) => this._compareLabels('write', a, b))[0];
        }
        return label;
    }

    _extractLowestLabel(label){
        if (label instanceof Set || label instanceof Array || Array.isArray(label)){
            return Array.from(label).sort((a, b) => -this._compareLabels('write', a, b))[0];
        }
        return label;
    }

    check(obj, sink, context = null) {
        this.checkCount ++;

        let obj_label = this._getLabel(obj, context);
        let sink_label = this._getLabel(sink, context);

        obj_label = this._extractHighestLabel(obj_label);
        sink_label = this._extractLowestLabel(sink_label);

        if (!obj_label || !sink_label){
            // console.log(`Sink is not labelled -- returning object`);
            return obj;
        }

        const distance = this._compareLabels('write', obj_label, sink_label);

        // console.log(obj, sink);
        // console.log(`Checking flow ${obj_label} -> ${sink_label} = ${distance}`);
        // if (PRINT_LOGS){
        //     console.log(`Checking flow ${obj_label} -> ${sink_label} = ${distance}`);
        // }

        if (distance !== null && distance >= 0){
            if (obj instanceof PrimitiveObject) return obj.value;
            return obj;
        }
        else {
            // console.log(obj, sink);
            // console.log(`Flow ${obj_label} -> ${sink_label} = ${distance}`);
            throw new SecurityViolation(`Writing an Object with label "${obj_label}" to a Sink with label "${sink_label}" is forbidden`, obj_label, sink_label);
        }
    };

    // check information flow during function invocation
    // thisArg is the sink object (callee)
    // and args contain the objects flowing into the sink.
    // if thisArg is given, then we assume func to be a string
    invoke(thisArg, func, args){
        // exception for console
        if (thisArg === console){
            return thisArg[func].apply(thisArg, args);
        }

        const callable = thisArg !== null ? thisArg[func] : func;

        // console.log(`Trying to invoke ${callable.name}...`);

        // if func is a global function, combine the labels and
        // assign it to the returned value
        if ((thisArg === null && func.name && func === global[func.name])
            || (thisArg && thisArg.name && thisArg === global[thisArg.name])){
            const serialized = args.map(arg => serializeObject(arg));
            const result = callable.apply(thisArg, serialized);

            // mirror the changes in the original objects
            serialized.forEach(arg => {
                identityPreservingDeepCopy(arg);
                OriginalToSerializedMap.delete(SerializedToOriginalMap.get(arg));
                SerializedToOriginalMap.delete(arg);
            });

            const label_result = this._combineLabels(...args.map(item => this._getLabel(item)));
            return this._setLabel(result, label_result);
        }

        const invocationContext = { object: thisArg, func: callable, args: args };
        for (let i = 0; i < args.length; i++){
            args[i] = this.check(args[i], thisArg || func, invocationContext);
            // args[i] = serializeObject(this.check(args[i], thisArg || func));
            // console.log(args[i], serializeObject(args[i]));
        }

        // no violation found, go ahead

        // if the test driver is running,
        // the built-ins have been replaced with the mock-ups.
        // We need to push the mock-up built-ins again
        // as the applications will now be referencing the mock-ups.
        let builtin_sinks;
        if (process.env.TURNSTILE_TEST_MODE){
            builtin_sinks = BUILTIN_SINKS.concat([
                fs.readFileSync,
                fs.readFile,
                fs.appendFileSync,
                fs.appendFile
            ]);
        }
        else {
            builtin_sinks = BUILTIN_SINKS;
        }

        // if callable is a built-in sink, we need to serialize the arguments
        if (builtin_sinks.includes(callable)){
            // some external functions modify the arguments in-place,
            // while we need to continue to reference the arguments passed to the external functions
            // To account for this case, we pass the serialized versions of the objects,
            // and then reflect the changes in the original objects afterwards
            // const sMap = new Map(); // original -> serialized
            // const dMap = new Map(); // serialized -> original
            // const sMap = OriginalToSerializedMap;
            // const dMap = SerializedToOriginalMap;

            const serialized = args.map(arg => serializeObject(arg));

            const result = callable.apply(thisArg, serialized);

            // mirror the changes in the original objects
            serialized.forEach(arg => {
                identityPreservingDeepCopy(arg);
                OriginalToSerializedMap.delete(SerializedToOriginalMap.get(arg));
                SerializedToOriginalMap.delete(arg);
            });

            if (SerializedToOriginalMap.has(result)){
                return SerializedToOriginalMap.get(result);
            }
            else {
                return result;
            }
        }
        else {
            // console.log(`invoke ${callable.name}`);
            return callable.apply(thisArg, args);
        }
    }

    binaryOp(op, first, second) {
        // console.log(`Binary op: ${first} ${op} ${second}`);

        // wrap the operands if they are primitive
        if (PRIMITIVE_TYPES.includes(typeof first) || first === undefined){
            // console.log(`... wrapping ${first}`);
            first = new PrimitiveObject(first);
        }

        if (PRIMITIVE_TYPES.includes(typeof second) || second === undefined){
            // console.log(`... wrapping ${second}`);
            second = new PrimitiveObject(second);
        }

        // retrieve the labels
        const label_first = this._getLabel(first);
        const label_second = this._getLabel(second);

        // since this is a binaryOp, we assume first and second to be primitive
        const result = PrimitiveObject.binaryOp(op, first, second);
        const label_result = this._combineLabels(label_first, label_second);

        this.labelMap.set(result, label_result);

        result[LABEL_PROPERTY] = serializeLabel(label_result);
        // console.log(`Assigning label ${JSON.stringify(result[LABEL_PROPERTY])} to the result of: ${first} ${op} ${second}`);
        return result;
    }

    interpolate(templateFunc, elements){
        const elemLabels = elements.map(elem => {
            // wrap the element if it is primitive
            if (PRIMITIVE_TYPES.includes(typeof elem)){
                elem = new PrimitiveObject(elem);
            }

            return this._getLabel(elem);
        });

        const result = new PrimitiveObject(templateFunc(elements.map(item => item instanceof PrimitiveObject ? item.value : item)));
        const label_result = this._combineLabels(...elemLabels);

        this.labelMap.set(result, label_result);

        result[LABEL_PROPERTY] = serializeLabel(label_result);
        return result;
    }

    // creates a wrapped version of the function such that
    // the returned value is newly issued a label using the handler
    issuer(func, handlerName){
        const labeller = this.labelIssuers[handlerName];
        const tracker = this;

        return function(...args){
            const obj = func.apply(this, args);

            const proxy = proxify(obj);

            if (labeller instanceof Function){
                let label = labeller(obj);
                if (label instanceof PrimitiveObject){
                    label = label.value;
                }
                tracker.labelMap.set(proxy, label);
                proxy[LABEL_PROPERTY] = serializeLabel(label);
            }
            else if (labeller.type === 'map'){
                obj.forEach((item, index, list) => {
                    const propProxy = proxify(item);
                    let propLabel = labeller.injector(item);
                    if (propLabel instanceof PrimitiveObject){
                        propLabel = propLabel.value;
                    }
                    tracker.labelMap.set(propProxy, propLabel);
                    propProxy[LABEL_PROPERTY] = serializeLabel(propLabel);
                    list[index] = propProxy;
                });
            }
            else {
                throw new Error(`Invalid label issuer provided for ${obj}`);
            }

            return proxy;
        }
    }

    // creates a wrapped version of the function such that
    // the function is always provided serialized arguments
    serialized(func, handlerName){
        const tracker = this;
        return function(...args){
            // some external functions modify the arguments in-place,
            // while we need to continue to reference the arguments passed to the external functions
            // To account for this case, we pass the serialized versions of the objects,
            // and then reflect the changes in the original objects afterwards
            // const sMap = new Map(); // original -> serialized
            // const dMap = new Map(); // serialized -> original
            // const sMap = OriginalToSerializedMap;
            // const dMap = SerializedToOriginalMap;

            const serialized = args.map(arg => serializeObject(arg));

            const result = func.apply(this, serialized);

            if (result instanceof Promise){
                result.finally(() => {
                    // mirror the changes in the original objects
                    serialized.forEach(arg => {
                        identityPreservingDeepCopy(arg);
                        OriginalToSerializedMap.delete(SerializedToOriginalMap.get(arg));
                        SerializedToOriginalMap.delete(arg);
                    });
                });
            }
            else {
                // mirror the changes in the original objects
                serialized.forEach(arg => {
                    identityPreservingDeepCopy(arg);
                    OriginalToSerializedMap.delete(SerializedToOriginalMap.get(arg));
                    SerializedToOriginalMap.delete(arg);
                });
            }

            if (SerializedToOriginalMap.has(result)){
                return SerializedToOriginalMap.get(result);
            }
            else {
                return result;
            }
        }
    }

    bool(obj) {
        return obj instanceof PrimitiveObject ? (!!obj.value) : obj;
    }

    printRules() {
        for (let i = 0; i < this.rules.length; i++) {
            const rule = this.rules[i];
            console.log(rule)
        }
    }

    printLabelMap() {
        console.log(this.labelMap)
    }
}
Tracker.Constants = {
    LABEL_PROPERTY: LABEL_PROPERTY
}
Tracker.SecurityViolation = SecurityViolation;
Tracker.getByFilePath = filePath => TrackerMap.get(filePath);

module.exports = Tracker;