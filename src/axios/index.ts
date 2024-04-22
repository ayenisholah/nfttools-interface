import axios, { AxiosInstance } from "axios";
import axiosRetry, { IAxiosRetryConfig } from "axios-retry";
import Bottleneck from "bottleneck";

let rate = 0
if (typeof window !== "undefined") {
  let settings: any = localStorage.getItem("settings");

  if (settings) {
    settings = JSON.parse(settings);
    rate = +settings?.state?.rateLimit
  }
}


export const limiter = new Bottleneck({
  minTime: 1 / rate,
});

const axiosInstance: AxiosInstance = axios.create({
  timeout: 300000,
});

const retryConfig: IAxiosRetryConfig = {
  retries: 3,
  retryDelay: (retryCount: number, error: any) => {
    limiter.schedule(() => Promise.resolve());
    if (error.response && error.response.status === 429) {
      return 1000;
    }
    return axiosRetry.exponentialDelay(retryCount);
  },
  retryCondition: async (error: any) => {
    if (
      axiosRetry.isNetworkError(error) || (error.response && error.response.status === 429)) {
      return true;
    }
    return false;
  },
};

axiosRetry(axiosInstance, retryConfig);

export default axiosInstance;