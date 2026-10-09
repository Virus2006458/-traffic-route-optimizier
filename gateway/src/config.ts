import dotenv from 'dotenv';
import path from 'path';

// Load .env from project root or gateway root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  tomtomApiKey: process.env.TOMTOM_API_KEY || process.env.VITE_TOMTOM_MAP_KEY || '',
  engineUrl: process.env.ENGINE_URL || 'http://localhost:8080',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
};
