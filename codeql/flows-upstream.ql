/**
 * @name Turnstile IO-to-IO discovery, upstream flows anchored at the sink
 * @kind path-problem
 * @problem.severity warning
 * @id DependableSystemsLab/turnstile-js/flows-upstream
 */

import javascript
import DataFlow::PathGraph
import Turnstile

class TrackUpstreamConfiguration extends TaintTracking::Configuration {
  TrackUpstreamConfiguration() { this = "TrackUpstreamConfiguration" }

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

from TrackUpstreamConfiguration dataflow, DataFlow::PathNode source, DataFlow::PathNode sink
where dataflow.hasFlowPath(source, sink)
select sink, source, sink, "IO-to-IO Sink"