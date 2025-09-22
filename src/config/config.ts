import dotenv from 'dotenv';


dotenv.config();

interface configInterface {
    expressPort: number;
    rtmpBaseUrl: string,
}
const config: configInterface = {
    expressPort: Number(process.env.EXPRESS_PORT) || 5000,
    rtmpBaseUrl: process.env.STREAM_RTMP_BASE_URL || '',
}
export default config;