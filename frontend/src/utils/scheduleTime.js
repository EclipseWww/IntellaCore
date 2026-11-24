/**
 * 课表时间统一按学校设置的时区（后端 SCHEDULE_TIMEZONE，默认 Asia/Shanghai）显示与比较，
 * 不受这台电脑系统时区的影响。
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

let TZ = 'Asia/Shanghai';
export const setScheduleTz = (tz) => { if (tz) TZ = tz; };
/** 现在（学校时区） */
export const nowTz = () => dayjs().tz(TZ);
/** 某天某个时刻（学校时区），如 atTz('2026-11-24', '08:00') */
export const atTz = (date, hm) => dayjs.tz(`${date} ${hm}`, TZ);
/** 把时间点换到学校时区 */
export const inTz = (d) => dayjs(d).tz(TZ);
