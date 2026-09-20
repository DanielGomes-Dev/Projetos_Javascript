import mongoose from '../config/database.js';
import Client from './client.model.js';
import Lawsuit from './lawsuit.model';
import DeadLetterJob from './deadLetterJob.model.js';


export { mongoose, Client, Lawsuit, DeadLetterJob };


