import {GraphWidget, Metric, Row, Stats, TextWidget} from "aws-cdk-lib/aws-cloudwatch";
import {IWidgetSet, WidgetSet} from "./widgetset";
import {Duration} from "aws-cdk-lib";
import {Construct} from "constructs";

export class LambdaWidgetSet extends WidgetSet implements IWidgetSet{
    namespace:string='AWS/Lambda';
    widgetSet:any = [];
    alarmSet:any = [];
    config:any = {};

    constructor(scope:Construct, id:string, resource:any, config:any) {
        super(scope, id);
        this.config = config;
        const functionName = resource.ResourceARN.split(':')[resource.ResourceARN.split(':').length - 1];
        let name = functionName
        const region = resource.ResourceARN.split(':')[3];
        const memory = resource.Configuration.MemorySize;
        const runtime = resource.Configuration.Runtime;
        for ( const tag of resource.Tags ){
            if ( tag.Key === "Name"){
                name = tag.Value
            }
        }
        let markDown = `### Lambda [${name}](https://${region}.console.aws.amazon.com/lambda/home?region=${region}#/functions/${functionName}?tab=monitoring) Mem:${memory} RT:${runtime}`

        const textWidget = new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1
        });

        this.addWidgetRow(textWidget);
        const widget = new GraphWidget({
            title: 'Invocations '+functionName,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'Invocations',
                dimensionsMap: {
                    FunctionName: functionName
                },
                statistic: Stats.SUM,
                period:Duration.minutes(1)
            })],
            right:[new Metric({
                namespace: this.namespace,
                metricName: 'Duration',
                dimensionsMap: {
                    FunctionName: functionName
                },
                statistic: Stats.AVERAGE,
                period:Duration.minutes(1)
            })],
            height: 5
        })
        const throttleMetric = new Metric({
            namespace: this.namespace,
            metricName: 'Throttles',
            dimensionsMap: {
                FunctionName: functionName
            },
            statistic: Stats.SUM,
            period:Duration.minutes(1)
        });

        const throttleAlarm = throttleMetric.createAlarm(this,`Throttles-${functionName}-${region}-${this.config.BaseName}`,{
            alarmName: `Throttles-${functionName}-${region}-${this.config.BaseName}`,
            datapointsToAlarm: 3,
            evaluationPeriods: 3,
            threshold: 10
        });

        this.alarmSet.push(throttleAlarm);

        const widgetErrors = new GraphWidget({
            title: 'Errors/Throttles '+functionName,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'Errors',
                dimensionsMap: {
                    FunctionName: functionName
                },
                statistic: Stats.SUM,
                period:Duration.minutes(1)
            })],
            right:[throttleMetric],
            width: 12,
            height: 5
        })

        const widgetConcurrent = new GraphWidget({
            title: 'Concurrency ' + functionName,
            region: region,
            left: [new Metric({
                namespace: this.namespace,
                metricName: 'ConcurrentExecutions',
                dimensionsMap: {
                    FunctionName: functionName
                },
                statistic: Stats.MAXIMUM,
                period:Duration.minutes(1)
            })],
            height: 5
        })

        this.addWidgetRow(widget,widgetErrors,widgetConcurrent);
    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }
}
