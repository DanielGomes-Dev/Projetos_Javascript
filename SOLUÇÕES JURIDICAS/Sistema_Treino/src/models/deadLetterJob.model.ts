import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.js';

interface DeadLetterJobAttributes {
  id: string;
  queueName: string;
  jobId: string;
  lawsuitId: string | null;
  payload: Record<string, unknown>;
  errorMessage: string;
  attemptsMade: number;
  failedAt: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

type DeadLetterJobCreationAttributes = Optional<DeadLetterJobAttributes, 'id' | 'lawsuitId' | 'failedAt'>;

class DeadLetterJob
  extends Model<DeadLetterJobAttributes, DeadLetterJobCreationAttributes>
  implements DeadLetterJobAttributes
{
  declare id: string;
  declare queueName: string;
  declare jobId: string;
  declare lawsuitId: string | null;
  declare payload: Record<string, unknown>;
  declare errorMessage: string;
  declare attemptsMade: number;
  declare failedAt: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

DeadLetterJob.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    queueName: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'queue_name',
    },
    jobId: {
      type: DataTypes.STRING,
      allowNull: false,
      field: 'job_id',
    },
    lawsuitId: {
      type: DataTypes.UUID,
      allowNull: true,
      field: 'lawsuit_id',
    },
    payload: {
      type: DataTypes.JSONB,
      allowNull: false,
    },
    errorMessage: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: 'error_message',
    },
    attemptsMade: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: 'attempts_made',
    },
    failedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: 'failed_at',
    },
  },
  {
    sequelize,
    modelName: 'DeadLetterJob',
    tableName: 'dead_letter_jobs',
    underscored: true,
  }
);

export default DeadLetterJob;