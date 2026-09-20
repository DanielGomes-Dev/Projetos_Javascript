import sequelize from '../config/database.js';
import Client from './client.model.js';
import Lawsuit from './lawsuit.model.js';
import Movement from './movement.model.js';
import DeadLetterJob from './deadLetterJob.model.js';

// Client 1:N Lawsuit
Client.hasMany(Lawsuit, { foreignKey: 'clientId', as: 'lawsuits' });
Lawsuit.belongsTo(Client, { foreignKey: 'clientId', as: 'client' });

// Lawsuit 1:N Movement
Lawsuit.hasMany(Movement, { foreignKey: 'lawsuitId', as: 'movements' });
Movement.belongsTo(Lawsuit, { foreignKey: 'lawsuitId', as: 'lawsuit' });

// Lawsuit 1:N DeadLetterJob (nullable — a FK vira NULL se o processo for removido)
Lawsuit.hasMany(DeadLetterJob, { foreignKey: 'lawsuitId', as: 'deadLetterJobs' });
DeadLetterJob.belongsTo(Lawsuit, { foreignKey: 'lawsuitId', as: 'lawsuit' });

export { sequelize, Client, Lawsuit, Movement, DeadLetterJob };