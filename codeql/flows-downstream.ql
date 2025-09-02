/**
 * @name Turnstile IO-to-IO discovery, downstream flows anchored at the source
 * @kind path-problem
 * @problem.severity warning
 * @id DependableSystemsLab/turnstile-js/flows-downstream
 */

import javascript
import DataFlow::PathGraph
import Turnstile

class TrackDownstreamConfiguration extends TaintTracking::Configuration {
  TrackDownstreamConfiguration() { this = "TrackDownstreamConfiguration" }

  override predicate isSource(DataFlow::Node source) {
    source instanceof IOSource
    or
    source instanceof ExpressSource
    or
    source instanceof NodeRedSource
  }

  override predicate isSink(DataFlow::Node sink) {
    sink instanceof IOSink
    or
    sink instanceof ExpressSink
    or
    sink instanceof NodeRedSink
  }
}

from TrackDownstreamConfiguration dataflow, DataFlow::PathNode source, DataFlow::PathNode sink
where dataflow.hasFlowPath(source, sink)
select source, source, sink, "IO-to-IO Source"