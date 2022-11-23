import { Injectable, NestMiddleware } from '@nestjs/common';
import { getUnixTime, sub } from 'date-fns';
import { Request, Response, NextFunction } from 'express';
import * as redis from 'redis';

const redis_client = redis.createClient();

const WINDOW_DURATION_IN_MINUTES = 10;
const MAX_WINDOW_REQUEST_COUNT = 5;
const WINDOW_LOG_DURATION_IN_MINUTES = 1;

@Injectable()
export class RateLimiterMiddleware implements NestMiddleware {
  async use(req: Request, res: Response, next: NextFunction) {
    console.log('Request...');
    await redis_client.connect();
    const ip = req.ip;
    try {
      console.log({ redis_client });

      if (!redis_client) {
        console.log('Redis client does not exist!');
        process.exit(1);
      }

      const currentTime = new Date();

      const record = await redis_client.get(ip);

      console.log({ record });

      if (!record) {
        const newRecord = [];
        const requestLog = {
          requestTimeStamp: getUnixTime(currentTime),
          requestCount: 1,
        };
        newRecord.push(requestLog);
        redis_client.set(req.ip, JSON.stringify(newRecord));
        next();
      }

      const data = JSON.parse(record);
      const windowBeginTimestamp = getUnixTime(
        sub(new Date(), { minutes: WINDOW_DURATION_IN_MINUTES }),
      );
      const requestsInWindow = data.filter((entry) => {
        return entry.requestTimeStamp > windowBeginTimestamp;
      });
      console.log('requestsinWindow', requestsInWindow);
      const totalWindowRequestsCount = requestsInWindow.reduce(
        (accumulator, entry) => {
          return accumulator + entry.requestCount;
        },
        0,
      );

      if (totalWindowRequestsCount >= MAX_WINDOW_REQUEST_COUNT) {
        redis_client.quit();
        res
          .status(429)
          .send(
            `You have exceeded the ${MAX_WINDOW_REQUEST_COUNT} requests in ${WINDOW_DURATION_IN_MINUTES} minutes limit!`,
          );
      } else {
        const lastRequestLog = data[data.length - 1];
        const potentialCurrentWindowIntervalStartTimeStamp = getUnixTime(
          sub(currentTime, { minutes: WINDOW_LOG_DURATION_IN_MINUTES }),
        );
        if (
          lastRequestLog.requestTimeStamp >
          potentialCurrentWindowIntervalStartTimeStamp
        ) {
          lastRequestLog.requestCount++;
          data[data.length - 1] = lastRequestLog;
        } else {
          data.push({
            requestTimeStamp: getUnixTime(currentTime),
            requestCount: 1,
          });
        }
        redis_client.set(req.ip, JSON.stringify(data));
        redis_client.quit();
        next();
      }
    } catch (error) {
      redis_client.quit();
      next(error);
    }
  }
}
