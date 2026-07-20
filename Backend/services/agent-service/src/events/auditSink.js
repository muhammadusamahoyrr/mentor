// Phase 2 hook sink: publish each tool-call log entry to Kafka topic
// `agent.tool.called`. audit-service consumes it (its topic regex now includes
// `agent`) and persists it to the AuditLog collection — turning the in-memory
// hook log into a durable, queryable audit trail with zero new storage code.
//
// Reuses the platform's shared Kafka producer (lazy-connecting, so importing this
// never blocks and a down broker never crashes the agent).
const { publish } = require('../../../../shared/events/kafkaProducer');

const TOPIC = 'agent.tool.called';

// Returns an onEvent callback for createToolLogger. Fire-and-forget: a logging
// sink must never break, slow, or reject into the agent's request path.
// AGENT_DISABLE_KAFKA=1 makes it a no-op (tests, or a deployment without Kafka).
function kafkaSink() {
  if (process.env.AGENT_DISABLE_KAFKA === '1') {
    return () => {};
  }
  return (entry) => {
    publish(TOPIC, { ...entry, service: 'agent-service' }).catch((err) => {
      console.warn(`[audit] could not publish ${TOPIC}: ${err.message}`);
    });
  };
}

module.exports = { kafkaSink, TOPIC };
