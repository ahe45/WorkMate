const { generateId } = require("./ids");

async function recordAuditLog(queryRunner, payload = {}) {
  await queryRunner(
    `
      INSERT INTO audit_logs (
        id,
        organization_id,
        actor_user_id,
        actor_type,
        action,
        entity_type,
        entity_id,
        request_id,
        ip_address,
        user_agent,
        before_json,
        after_json,
        metadata_json
      )
      VALUES (
        :id,
        :organizationId,
        :actorUserId,
        :actorType,
        :action,
        :entityType,
        :entityId,
        :requestId,
        :ipAddress,
        :userAgent,
        :beforeJson,
        :afterJson,
        :metadataJson
      )
    `,
    {
      id: generateId(),
      organizationId: payload.organizationId || null,
      actorUserId: payload.actorUserId || null,
      actorType: payload.actorType || "USER",
      action: payload.action || "UNKNOWN",
      entityType: payload.entityType || "system",
      entityId: payload.entityId || null,
      requestId: payload.requestId || null,
      ipAddress: payload.ipAddress || null,
      userAgent: payload.userAgent || null,
      beforeJson: payload.beforeJson ? JSON.stringify(payload.beforeJson) : null,
      afterJson: payload.afterJson ? JSON.stringify(payload.afterJson) : null,
      metadataJson: payload.metadataJson ? JSON.stringify(payload.metadataJson) : null,
    },
  );
}

module.exports = {
  recordAuditLog,
};
