'use strict';

/**
 * Baseline: the schema exactly as `sequelize.sync()` had built it on 2026-09-24 (taken from a
 * `mysqldump --no-data` of the dev database, not from DATABASE_SCHEMA.md's CREATE TABLE blocks).
 *
 * Databases created before migrations existed already have these tables, so on those this
 * migration is a no-op that only gets recorded in SequelizeMeta. A fresh database is built from it.
 *
 * FKs: sync() produced ON DELETE RESTRICT / ON UPDATE CASCADE, except jobs.file_id and
 * password_reset_requests.resolved_by_user_id, which are ON DELETE SET NULL.
 * notifications_log has no FKs at all.
 */

const TABLES = [
  'users', 'files', 'jobs', 'payments', 'refresh_tokens', 'push_subscriptions',
  'notifications_log', 'settings', 'password_reset_requests',
];

module.exports = {
  async up(queryInterface, Sequelize) {
    const existing = (await queryInterface.showAllTables()).map((t) => (typeof t === 'string' ? t : t.tableName));
    if (existing.includes('users')) {
      console.log('[baseline] existing schema detected, marking baseline as applied without changes');
      return;
    }

    const { DataTypes } = Sequelize;
    const uuidPk = { type: DataTypes.UUID, allowNull: false, primaryKey: true };
    const userFk = {
      type: DataTypes.UUID, allowNull: false,
      references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE',
    };

    await queryInterface.createTable('users', {
      id:             uuidPk,
      name:           { type: DataTypes.STRING(255), allowNull: false },
      phone:          { type: DataTypes.STRING(20), allowNull: false, unique: true },
      house_number:   { type: DataTypes.STRING(20), allowNull: false },
      estate:         { type: DataTypes.STRING(255), allowNull: false },
      password_hash:  { type: DataTypes.STRING(255), allowNull: false },
      role:           { type: DataTypes.ENUM('customer', 'clerk', 'admin'), defaultValue: 'customer' },
      notif_sms:      { type: DataTypes.BOOLEAN, defaultValue: true },
      notif_whatsapp: { type: DataTypes.BOOLEAN, defaultValue: false },
      credit_balance: { type: DataTypes.DECIMAL(10, 2), defaultValue: 0 },
      loyalty_points: { type: DataTypes.INTEGER, defaultValue: 0 },
      active:         { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      created_at:     { type: DataTypes.DATE, allowNull: false },
      updated_at:     { type: DataTypes.DATE, allowNull: false },
    });

    await queryInterface.createTable('files', {
      id:            uuidPk,
      user_id:       userFk,
      original_name: { type: DataTypes.STRING(500), allowNull: false },
      stored_name:   { type: DataTypes.STRING(500), allowNull: false },
      mime_type:     { type: DataTypes.STRING(100), allowNull: false },
      size_bytes:    { type: DataTypes.INTEGER, allowNull: false },
      page_count:    { type: DataTypes.INTEGER, defaultValue: 1 },
      file_key:      { type: DataTypes.STRING(1000), allowNull: false },
      pdf_key:       { type: DataTypes.STRING(1000), allowNull: true },
      created_at:    { type: DataTypes.DATE, allowNull: true },
    });
    await queryInterface.addIndex('files', ['user_id'], { name: 'idx_user_id' });

    await queryInterface.createTable('jobs', {
      id:             uuidPk,
      user_id:        userFk,
      file_id: {
        type: DataTypes.UUID, allowNull: true,
        references: { model: 'files', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
      file_name:      { type: DataTypes.STRING(500), allowNull: true },
      file_key:       { type: DataTypes.STRING(1000), allowNull: true },
      instructions:   { type: DataTypes.TEXT, allowNull: true },
      pages:          { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      copies:         { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      total_pages:    { type: DataTypes.INTEGER, allowNull: true },
      page_selection: { type: DataTypes.STRING(500), allowNull: true },
      color_mode:     { type: DataTypes.ENUM('bw', 'color'), allowNull: false, defaultValue: 'bw' },
      sides:          { type: DataTypes.ENUM('single', 'double'), allowNull: false, defaultValue: 'single' },
      paper_size:     { type: DataTypes.STRING(20), allowNull: false, defaultValue: 'A4' },
      delivery_type:  { type: DataTypes.ENUM('pickup', 'delivery'), allowNull: false, defaultValue: 'pickup' },
      payment_method: { type: DataTypes.ENUM('mpesa', 'pay_on_pickup'), allowNull: false, defaultValue: 'mpesa' },
      payment_status: { type: DataTypes.ENUM('unpaid', 'paid', 'pay_on_pickup'), allowNull: false, defaultValue: 'unpaid' },
      // No DB default here: the soft-cancel ALTER dropped it. The next migration restores it.
      status: {
        type: DataTypes.ENUM('pending', 'printing', 'ready', 'delivered', 'cancelled'), allowNull: false,
      },
      ready_at:                  { type: DataTypes.DATE, allowNull: true },
      ready_overdue_notified_at: { type: DataTypes.DATE, allowNull: true },
      cost:           { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      delivery_fee:   { type: DataTypes.DECIMAL(10, 2), allowNull: false, defaultValue: 0 },
      mpesa_ref:      { type: DataTypes.STRING(50), allowNull: true },
      admin_notes:    { type: DataTypes.TEXT, allowNull: true },
      created_at:     { type: DataTypes.DATE, allowNull: false },
      updated_at:     { type: DataTypes.DATE, allowNull: false },
      cancelled_at:   { type: DataTypes.DATE, allowNull: true },
      cancelled_by:   { type: DataTypes.UUID, allowNull: true },
    });
    await queryInterface.addIndex('jobs', ['user_id'], { name: 'idx_user_id' });

    await queryInterface.createTable('payments', {
      id:      uuidPk,
      job_id: {
        type: DataTypes.UUID, allowNull: false, unique: true,
        references: { model: 'jobs', key: 'id' }, onUpdate: 'CASCADE',
      },
      user_id:         userFk,
      method:          { type: DataTypes.ENUM('mpesa', 'cash', 'pay_on_pickup'), allowNull: false },
      amount:          { type: DataTypes.DECIMAL(10, 2), allowNull: false },
      status:          { type: DataTypes.ENUM('pending', 'completed', 'failed', 'cancelled'), allowNull: false, defaultValue: 'pending' },
      mpesa_ref:       { type: DataTypes.STRING(50), allowNull: true },
      mpesa_receipt:   { type: DataTypes.STRING(100), allowNull: true },
      phone:           { type: DataTypes.STRING(20), allowNull: true },
      merchant_req_id: { type: DataTypes.STRING(100), allowNull: true },
      checkout_req_id: { type: DataTypes.STRING(100), allowNull: true },
      result_code:     { type: DataTypes.STRING(10), allowNull: true },
      result_desc:     { type: DataTypes.STRING(500), allowNull: true },
      paid_at:         { type: DataTypes.DATE, allowNull: true },
      created_at:      { type: DataTypes.DATE, allowNull: false },
      updated_at:      { type: DataTypes.DATE, allowNull: false },
    });
    await queryInterface.addIndex('payments', ['user_id'], { name: 'idx_user_id' });

    await queryInterface.createTable('refresh_tokens', {
      id:         uuidPk,
      user_id:    userFk,
      token_hash: { type: DataTypes.STRING(255), allowNull: false, unique: true },
      expires_at: { type: DataTypes.DATE, allowNull: false },
      revoked:    { type: DataTypes.BOOLEAN, defaultValue: false },
      created_at: { type: DataTypes.DATE, allowNull: true },
    });
    await queryInterface.addIndex('refresh_tokens', ['user_id'], { name: 'idx_user_id' });

    await queryInterface.createTable('push_subscriptions', {
      id:         uuidPk,
      user_id:    userFk,
      endpoint:   { type: DataTypes.TEXT, allowNull: false },
      p256dh:     { type: DataTypes.TEXT, allowNull: false },
      auth:       { type: DataTypes.TEXT, allowNull: false },
      created_at: { type: DataTypes.DATE, allowNull: true },
    });
    await queryInterface.addIndex('push_subscriptions', ['user_id'], { name: 'idx_user_id' });

    await queryInterface.createTable('notifications_log', {
      id:          uuidPk,
      job_id:      { type: DataTypes.STRING(36), allowNull: false },
      user_id:     { type: DataTypes.UUID, allowNull: false },
      channel:     { type: DataTypes.ENUM('sms', 'whatsapp', 'push'), allowNull: false },
      trigger:     { type: DataTypes.STRING(100), allowNull: false },
      phone:       { type: DataTypes.STRING(20), allowNull: true },
      message:     { type: DataTypes.TEXT, allowNull: false },
      status:      { type: DataTypes.ENUM('sent', 'failed'), allowNull: false, defaultValue: 'sent' },
      provider_id: { type: DataTypes.STRING(200), allowNull: true },
      sent_at:     { type: DataTypes.DATE, allowNull: true },
    });
    await queryInterface.addIndex('notifications_log', ['user_id'], { name: 'idx_user_id' });

    await queryInterface.createTable('settings', {
      key:   { type: DataTypes.STRING(50), allowNull: false, primaryKey: true },
      value: { type: DataTypes.TEXT('long'), allowNull: false },
    });

    await queryInterface.createTable('password_reset_requests', {
      id:      uuidPk,
      user_id: userFk,
      status:  { type: DataTypes.ENUM('pending', 'resolved'), defaultValue: 'pending' },
      created_at:  { type: DataTypes.DATE, allowNull: true },
      resolved_at: { type: DataTypes.DATE, allowNull: true },
      resolved_by_user_id: {
        type: DataTypes.UUID, allowNull: true,
        references: { model: 'users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'SET NULL',
      },
    });
    await queryInterface.addIndex('password_reset_requests', ['user_id'], { name: 'idx_user_id' });
    await queryInterface.addIndex('password_reset_requests', ['status'], { name: 'idx_status' });
  },

  async down(queryInterface) {
    for (const table of [...TABLES].reverse()) {
      await queryInterface.dropTable(table);
    }
  },
};
