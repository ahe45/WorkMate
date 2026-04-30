function createBootstrapObsoleteSchemaCleanup(schemaHelpers) {
  const {
    addColumnIfMissing,
    dropColumnIfExists,
    dropForeignKeyIfExists,
    dropIndexIfExists,
    dropTableIfExists,
    hasColumn,
    hasTable,
  } = schemaHelpers;

  async function simplifyUnimplementedSchema(connection) {
    if (await hasTable(connection, "leave_requests")) {
      await addColumnIfMissing(
        connection,
        "leave_requests",
        "approval_status",
        "VARCHAR(20) NOT NULL DEFAULT 'SUBMITTED' AFTER request_reason",
      );
      await addColumnIfMissing(
        connection,
        "leave_requests",
        "cancelled_at",
        "DATETIME(3) NULL AFTER approval_status",
      );

      if (await hasTable(connection, "approval_requests") && await hasColumn(connection, "leave_requests", "approval_request_id")) {
        await connection.query(`
          UPDATE leave_requests lr
          INNER JOIN approval_requests ar ON ar.id = lr.approval_request_id
          SET
            lr.approval_status = ar.status,
            lr.cancelled_at = ar.cancelled_at
        `);
      }

      await dropForeignKeyIfExists(connection, "leave_requests", "fk_leave_requests_approval");
      await dropIndexIfExists(connection, "leave_requests", "uk_leave_requests_approval");
      await dropColumnIfExists(connection, "leave_requests", "approval_request_id");
    }

    await dropTableIfExists(connection, "approval_requests");
    await dropTableIfExists(connection, "files");
    await dropTableIfExists(connection, "site_allowed_wifi_networks");
    await dropTableIfExists(connection, "site_auth_policies");

    const obsoleteColumns = [
      ["schedule_assignments", "priority_order"],
      ["schedule_assignments", "created_by"],
      ["shift_instances", "source_type"],
      ["shift_instances", "shift_metadata_json"],
      ["work_policies", "weekly_warning_threshold_minutes"],
      ["work_policies", "weekly_hard_lock_threshold_minutes"],
      ["work_policies", "clock_in_early_window_minutes"],
      ["work_policies", "clock_in_late_window_minutes"],
      ["work_policies", "auto_break_enabled"],
      ["work_policies", "auto_break_rules_json"],
      ["work_policies", "next_day_cutoff_time"],
      ["work_policies", "night_work_start"],
      ["work_policies", "night_work_end"],
      ["work_policies", "require_pre_approval_for_overtime"],
      ["work_policies", "allow_post_approval_overtime"],
      ["work_policies", "allow_clock_out_from_offsite"],
      ["work_policies", "allow_wfh"],
    ];

    await dropForeignKeyIfExists(connection, "schedule_assignments", "fk_schedule_assignments_created_by");

    for (const [tableName, columnName] of obsoleteColumns) {
      await dropColumnIfExists(connection, tableName, columnName);
    }
  }

  async function removeObsoleteSchema(connection) {
    await dropForeignKeyIfExists(connection, "approval_requests", "fk_approval_requests_final_decision_by");
    await dropForeignKeyIfExists(connection, "approval_requests", "fk_approval_requests_requester");
    await dropForeignKeyIfExists(connection, "approval_requests", "fk_approval_requests_target");
    await dropForeignKeyIfExists(connection, "attendance_events", "fk_attendance_events_device");
    await dropForeignKeyIfExists(connection, "attendance_anomalies", "fk_attendance_anomalies_resolved_by");
    await dropIndexIfExists(connection, "approval_requests", "idx_approval_requests_requester");
    await dropIndexIfExists(connection, "approval_requests", "idx_approval_requests_target");
    await dropIndexIfExists(connection, "approval_requests", "idx_approval_requests_org_type_status");

    const obsoleteColumns = [
      ["approval_requests", "source_entity_type"],
      ["approval_requests", "source_entity_id"],
      ["approval_requests", "title"],
      ["approval_requests", "reason"],
      ["approval_requests", "current_step_order"],
      ["approval_requests", "final_decision_at"],
      ["approval_requests", "final_decision_by"],
      ["approval_requests", "request_type"],
      ["approval_requests", "requester_id"],
      ["approval_requests", "requested_from"],
      ["approval_requests", "requested_to"],
      ["approval_requests", "request_payload_json"],
      ["approval_requests", "target_user_id"],
      ["attendance_events", "occurred_at_local"],
      ["attendance_events", "device_id"],
      ["attendance_events", "beacon_snapshot_json"],
      ["attendance_anomalies", "resolved_at"],
      ["attendance_anomalies", "resolved_by_user_id"],
      ["attendance_sessions", "night_minutes"],
      ["attendance_sessions", "holiday_minutes"],
      ["attendance_sessions", "summary_status"],
      ["attendance_sessions", "last_recalculated_at"],
      ["leave_balances", "source_type"],
      ["leave_types", "deduct_balance_flag"],
      ["leave_types", "paid_flag"],
      ["leave_types", "requires_approval"],
      ["roles", "is_system_role"],
      ["roles", "permissions_json"],
      ["schedule_template_days", "core_time_start"],
      ["schedule_template_days", "core_time_end"],
      ["schedule_template_days", "day_rule_json"],
      ["schedule_templates", "template_json"],
      ["site_allowed_wifi_networks", "ssid"],
      ["user_unit_assignments", "assignment_type"],
      ["user_unit_assignments", "is_primary"],
      ["users", "locale"],
      ["users", "last_login_at"],
      ["users", "profile_image_file_id"],
    ];

    for (const [tableName, columnName] of obsoleteColumns) {
      await dropColumnIfExists(connection, tableName, columnName);
    }

    await dropTableIfExists(connection, "user_unit_assignments");
  }

  return {
    removeObsoleteSchema,
    simplifyUnimplementedSchema,
  };
}

module.exports = {
  createBootstrapObsoleteSchemaCleanup,
};
