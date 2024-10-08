import {Construct} from "constructs";
import {IWidgetSet, WidgetSet} from "./widgetset";
import {
    GraphWidget,
    Metric,
    Row,
    Stats,
    TextWidget,
    TreatMissingData
} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";

export class EcsFargateWidgetSet extends WidgetSet implements IWidgetSet{
    namespace:string = "AWS/ECS";
    widgetSet:any = [];
    alarmSet:any = [];
    config:any = {};


    constructor(scope: Construct, id: string, service:any, clusterName:string, config:any) {
        super(scope, id);
        this.config = config;
        const region = service.serviceArn.split(':')[3];
        const serviceName = service.serviceName;
        const runningTasks = service.runningCount;
        let markDown = `***ECS Fargate Service [${serviceName}](https://${region}.console.aws.amazon.com/ecs/home?region=${region}#/clusters/${clusterName}/services/${serviceName}/details) [${clusterName}](https://${region}.console.aws.amazon.com/ecs/home?region=${region}#/clusters/${clusterName}/services) Tasks: ${runningTasks}***`;
        const textWidget = new TextWidget({
            markdown: markDown,
            width: 24,
            height: 1
        });

        this.addWidgetRow(textWidget);

        const CPUUtilisationMetric = new Metric({
            namespace: this.namespace,
            metricName: 'CPUUtilization',
            region: region,
            dimensionsMap: {
                ClusterName: clusterName,
                ServiceName: serviceName
            },
            period: Duration.minutes(1),
            statistic: Stats.AVERAGE
        });

        const CPUEC2UtilAlarm = CPUUtilisationMetric.createAlarm(this,`CPUUtilisationAlarm-${clusterName}-${serviceName}-${this.config.BaseName}`,{
            alarmName:`CPUUtilisationAlarm-${clusterName}-${serviceName}-${this.config.BaseName}`,
            datapointsToAlarm: 3,
            evaluationPeriods: 3,
            threshold: 95,
            treatMissingData: TreatMissingData.MISSING
        });

        const MemoryUtilizationMetric = new Metric({
            namespace: this.namespace,
            metricName: 'MemoryUtilization',
            region: region,
            dimensionsMap: {
                ClusterName: clusterName,
                ServiceName: serviceName
            },
            period: Duration.minutes(1),
            statistic: Stats.AVERAGE
        });

        const ServiceCPUUtilisation = new GraphWidget({
            title: 'CPU/Memory Utilisation',
            region: region,
            left: [CPUUtilisationMetric],
            right: [MemoryUtilizationMetric],
            period: Duration.minutes(1),
            statistic: Stats.AVERAGE,
            width: 24
        });

        this.addWidgetRow(ServiceCPUUtilisation);
        this.alarmSet.push(CPUEC2UtilAlarm);

    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }
}