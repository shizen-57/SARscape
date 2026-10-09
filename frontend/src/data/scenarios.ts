import config from '../../../database/scenarios.json'
export type Scenario = { id:string;name:string;country:string;center:[number,number];zoom:number;bearing:number;pitch:number;kind:'glacier'|'wetland'|'forest';title:string;subtitle:string;unit:string;metric:string;product:string;explanation:string;extent:[number,number,number,number];imageryExtent?:[number,number,number,number];path:[number,number][] }
export const scenarios=config.scenarios as Scenario[]
export const dates=config.dates
export const formatDate=(date:string,options:Intl.DateTimeFormatOptions={month:'short',day:'numeric'})=>/^\d{4}$/.test(date)?date:new Intl.DateTimeFormat('en-US',{...options,timeZone:'UTC'}).format(new Date(date.includes('T')?date:date+'T12:00:00Z'))
