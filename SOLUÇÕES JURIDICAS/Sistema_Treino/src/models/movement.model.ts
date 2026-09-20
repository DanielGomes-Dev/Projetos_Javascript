import { DataTypes, Model, type Optional } from 'sequelize';
import sequelize from '../config/database.js';

interface MovementAttributes {
  id: string;
  lawsuitId: string;
  description: string;
  date: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

type MovementCreationAttributes = Optional<MovementAttributes, 'id'>;

class Movement extends Model<MovementAttributes, MovementCreationAttributes> implements MovementAttributes {
  declare id: string;
  declare lawsuitId: string;
  declare description: string;
  declare date: Date;
  declare readonly createdAt: Date;
  declare readonly updatedAt: Date;
}

Movement.init(
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    lawsuitId: {
      type: DataTypes.UUID,
      allowNull: false,
      field: 'lawsuit_id',
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    date: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: 'Movement',
    tableName: 'movements',
    underscored: true,
  }
);

export default Movement;
