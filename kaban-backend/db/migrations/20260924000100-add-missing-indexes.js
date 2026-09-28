'use strict';

/**
 * Adds the indexes DATABASE_SCHEMA.md always listed but the models never created, and restores
 * the DB default on jobs.status (dropped by the hand-run soft-cancel ALTER).
 *
 * idx_checkout_req_id is deliberately non-unique: making it unique could fail on existing rows.
 */

const INDEXES = [
  ['jobs', 'status', 'idx_status'],
  ['jobs', 'payment_status', 'idx_payment_status'],
  ['jobs', 'created_at', 'idx_created_at'],
  ['payments', 'checkout_req_id', 'idx_checkout_req_id'],
  ['payments', 'mpesa_ref', 'idx_mpesa_ref'],
  ['notifications_log', 'job_id', 'idx_job_id'],
];

const JOB_STATUSES = ['pending', 'printing', 'ready', 'delivered', 'cancelled'];

module.exports = {
  async up(queryInterface, Sequelize) {
    for (const [table, column, name] of INDEXES) {
      await queryInterface.addIndex(table, [column], { name });
    }
    await queryInterface.changeColumn('jobs', 'status', {
      type: Sequelize.DataTypes.ENUM(...JOB_STATUSES), allowNull: false, defaultValue: 'pending',
    });
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.changeColumn('jobs', 'status', {
      type: Sequelize.DataTypes.ENUM(...JOB_STATUSES), allowNull: false,
    });
    for (const [table, , name] of [...INDEXES].reverse()) {
      await queryInterface.removeIndex(table, name);
    }
  },
};
