import javascript

// support for built-in nodejs objects

class IOSource extends DataFlow::Node {
  IOSource() {
    this = DataFlow::globalVarRef("process").getAPropertyRead("stdin").getAMemberCall("on").getCallback(1).getParameter(0)
    or
    this = DataFlow::moduleMember("fs", "createReadStream").getACall().getAMemberCall("on").getCallback(1).getParameter(0)
    or
    this = DataFlow::moduleMember("fs", "readFile").getACall().getCallback(2).getParameter(1)
    or
    this = DataFlow::moduleMember("fs", "readFileSync").getACall()
    or
    this = DataFlow::moduleMember("child_process", "exec").getACall().getCallback(1).getParameter(1)
    or
    this = DataFlow::moduleMember("child_process", "exec").getACall().getCallback(1).getParameter(2)
    or
    this = DataFlow::moduleMember("child_process", "spawn").getACall().getAPropertyRead("stdout").getAMemberCall("on").getCallback(1).getParameter(0)
    or
    this = DataFlow::moduleMember("child_process", "spawn").getACall().getAPropertyRead("stderr").getAMemberCall("on").getCallback(1).getParameter(0)
    or
    this = DataFlow::moduleMember("net", "createServer").getACall().getCallback(0).getParameter(0).getAMemberCall("on").getCallback(1).getParameter(0)
    or
    this = DataFlow::moduleMember("net", "createServer").getACall().getAMemberCall("on").getCallback(1).getParameter(0).getAMemberCall("on").getCallback(1).getParameter(0)
    or
    this = DataFlow::moduleMember("net", "Server").getAnInstantiation().getAMemberCall("on").getCallback(1).getParameter(0).getAMemberCall("on").getCallback(1).getParameter(0)
    or
    this = DataFlow::moduleMember("net", "createConnection").getACall().getAMemberCall("on").getCallback(1).getParameter(0)
    or
    this = DataFlow::moduleMember("net", "connect").getACall().getAMemberCall("on").getCallback(1).getParameter(0)
    or
    this = DataFlow::moduleMember("net", "Socket").getAnInstantiation().getAMemberCall("on").getCallback(1).getParameter(0)
  }
}

class IOSink extends DataFlow::Node {
  IOSink() {
    this = DataFlow::globalVarRef("process").getAPropertyRead("stdout").getAMemberCall("write").getArgument(0)
    or
    this = DataFlow::moduleMember("fs", "createWriteStream").getACall().getAMemberCall("write").getArgument(0)
    or
    this = DataFlow::moduleMember("fs", "writeFile").getACall().getArgument(1)
    or
    this = DataFlow::moduleMember("fs", "writeFileSync").getACall().getArgument(1)
    or
    this = DataFlow::moduleMember("child_process", "spawn").getACall().getAPropertyRead("stdin").getAMemberCall("write").getArgument(0)
    or
    this = DataFlow::moduleMember("net", "createServer").getACall().getCallback(0).getParameter(0).getAMemberCall("write").getArgument(0)
    or
    this = DataFlow::moduleMember("net", "createServer").getACall().getAMemberCall("on").getCallback(1).getParameter(0).getAMemberCall("write").getArgument(0)
    or
    this = DataFlow::moduleMember("net", "Server").getAnInstantiation().getAMemberCall("on").getCallback(1).getParameter(0).getAMemberCall("write").getArgument(0)
    or
    this = DataFlow::moduleMember("net", "createConnection").getACall().getAMemberCall("write").getArgument(0)
    or
    this = DataFlow::moduleMember("net", "connect").getACall().getAMemberCall("write").getArgument(0)
    or
    this = DataFlow::moduleMember("net", "Socket").getAnInstantiation().getAMemberCall("write").getArgument(0)
  }
}

DataFlow::SourceNode getExpressRequest(){
  exists(DataFlow::Node node |
    Express::isRequest(node)
    and
    result = node
    )
}

DataFlow::SourceNode getExpressResponse(){
  exists(DataFlow::Node node |
    Express::isResponse(node)
    and
    result = node
    )
}

// extension for express.js
class ExpressSource extends DataFlow::Node {
  ExpressSource() {
    this = getExpressRequest()
  }
}

class ExpressSink extends DataFlow::Node {
  ExpressSink() {
    this = getExpressResponse().getAMemberCall("send").getArgument(0)
    or
    this = getExpressResponse().getAMemberCall("json").getArgument(0)
  }
}

DataFlow::ThisNode getNodeRed(){
  exists(DataFlow::ParameterNode par, StmtContainer container |
    par.getName() = "RED"
    and
    container = par.getAPropertyRead("nodes").getAMemberCall("createNode").getArgument(0).getContainer()
    and
    result = DataFlow::thisNode(container)
    )
}

// extension for node-red
class NodeRedSource extends DataFlow::Node {
  NodeRedSource() {
    this = getNodeRed().getAMemberCall("on").getCallback(1).getParameter(0)
  }
}

class NodeRedSink extends DataFlow::Node {
  NodeRedSink() {
    this = getNodeRed().getAMemberCall("send").getArgument(0)
  }
}