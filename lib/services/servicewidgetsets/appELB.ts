import {Construct} from "constructs";
import {IWidgetSet, WidgetSet} from "./widgetset";
import {GraphWidget, Metric, Stats, TextWidget, TreatMissingData, Unit} from "aws-cdk-lib/aws-cloudwatch";
import {Duration} from "aws-cdk-lib";

export class ApplicationELBWidgetSet extends WidgetSet implements IWidgetSet{
    namespace:string = "AWS/ApplicationELB";
    widgetSet:any = [];
    alarmSet:any = [];
    config:any = {};

    constructor(scope: Construct, id: string, resource:any, config:any) {
        super(scope, id);
        this.config = config;
        const elbName = resource.Extras.LoadBalancerName
        const targetGroups = resource.TargetGroups;
        const region = resource.ResourceARN.split(':')[3];
        const type = resource.Extras.Type
        const elbID = resource.ResourceARN.split('/')[3]
        const elbCWName = 'app/' + elbName + '/' + elbID;

        const textWidget = new TextWidget({
            markdown: "**ELB (ALB) " + elbName+'**',
            width: 24,
            height: 1
        });

        this.addWidgetRow(textWidget);

        /***
         * Metrics
         */
        const activeConnMetric = new Metric({
            namespace: this.namespace,
            metricName: 'ActiveConnectionCount',
            statistic: Stats.SUM,
            dimensionsMap: {
                LoadBalancer: elbCWName
            },
            period: Duration.seconds(1),
            region: region,
            unit:Unit.COUNT

        });

        const newConnectionMetric = new Metric({
            namespace: this.namespace,
            metricName: 'NewConnectionCount',
            statistic: Stats.SUM,
            dimensionsMap:{
                LoadBalancer: elbCWName
            },
            period: Duration.seconds(1),
            region: region,
            unit:Unit.COUNT
        });

        const consumedLCUMetric = new Metric({
            namespace: this.namespace,
            metricName: 'ConsumedLCUs',
            statistic: Stats.SUM,
            dimensionsMap:{
                LoadBalancer: elbCWName
            },
            period: Duration.seconds(1),
            region: region,
            unit:Unit.COUNT
        });

        const fixedResponseCount = new Metric({
            namespace: this.namespace,
            metricName: 'HTTP_Fixed_Response_Count',
            statistic: Stats.SUM,
            dimensionsMap:{
                LoadBalancer: elbCWName
            },
            period: Duration.seconds(1),
            region: region,
            unit:Unit.COUNT
        });

        const httpRedirectCount = new Metric({
            namespace: this.namespace,
            metricName: 'HTTP_Redirect_Count',
            statistic: Stats.SUM,
            dimensionsMap:{
                LoadBalancer: elbCWName
            },
            period: Duration.seconds(1),
            region: region,
            unit:Unit.COUNT
        });

        const elb5xxMetric = new Metric({
            namespace: this.namespace,
            metricName: 'HTTPCode_ELB_5XX_Count',
            statistic: Stats.SUM,
            dimensionsMap:{
                LoadBalancer: elbCWName
            },
            period: Duration.seconds(60),
            region: region
        })

        const backend5xxMetric = new Metric({
            namespace: this.namespace,
            metricName: 'HTTPCode_Target_5XX_Count',
            statistic: Stats.SUM,
            dimensionsMap: {
                LoadBalancer: elbCWName
            },
            period: Duration.seconds(60),
            region: region
        });

        const rejectedConnectionMetric = new Metric({
            namespace: this.namespace,
            metricName: 'RejectedConnectionCount',
            statistic: Stats.SUM,
            dimensionsMap: {
                LoadBalancer: elbCWName
            },
            period: Duration.minutes(1),
            region: region
        });




        let unhealthyHostCountMetricArray = [];
        let targetResponseTimeArray = [];
        for (let targetGroup of targetGroups){

            let targetGroupArn = targetGroup.TargetGroupArn;

            let targetGroupName = targetGroupArn.split(':')[targetGroupArn.split(':').length-1]

            let unhealthyMetric = new Metric({
                namespace: this.namespace,
                metricName: 'UnHealthyHostCount',
                dimensionsMap: {
                    TargetGroup: targetGroupName,
                    LoadBalancer: elbCWName

                },
                statistic: Stats.MAXIMUM,
                period: Duration.minutes(1),
                unit: Unit.COUNT,
                region:region
            });

            let targetResponseTime = new Metric({
                namespace: this.namespace,
                metricName: 'TargetResponseTime',
                dimensionsMap: {
                    TargetGroup: targetGroupName,
                    LoadBalancer: elbCWName

                },
                statistic: Stats.AVERAGE,
                period: Duration.minutes(1),
                unit: Unit.COUNT,
                region:region
            });

            let unhealthyAlarm = unhealthyMetric.createAlarm(this,`UHAlarm-${targetGroupName}-${region}-${this.config.BaseName}`,{
                alarmName: `Unhealthy-Hosts-Alarm-${targetGroupName}-${region}-${this.config.BaseName}`,
                datapointsToAlarm: 3,
                evaluationPeriods: 3,
                threshold: 3,
                treatMissingData: TreatMissingData.NOT_BREACHING
            });

            this.alarmSet.push(unhealthyAlarm);
            unhealthyHostCountMetricArray.push(unhealthyMetric);
            targetResponseTimeArray.push(targetResponseTime);
        }

        /***
         * Alarms
         */
        const elb5xxAlarm = elb5xxMetric.createAlarm(scope,`5xxAlarm-${elbName}-${region}-${this.config.BaseName}`,{
            alarmName: `5xxAlarm-${elbName}-${region}-${this.config.BaseName}`,
            threshold: 2,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            evaluationPeriods: 2,
            datapointsToAlarm: 2
        })

        const backend5xxAlarm = backend5xxMetric.createAlarm(scope,`Backend5xxAlarm-${elbName}-${region}-${this.config.BaseName}`,{
            alarmName: `Backend5xxAlarm-${elbName}-${region}-${this.config.BaseName}`,
            threshold: 2,
            treatMissingData: TreatMissingData.NOT_BREACHING,
            evaluationPeriods: 2,
            datapointsToAlarm: 2
        })

        /***
         * Widgets
         */

        const connectionsWidget = new GraphWidget({
            title: 'Active/New Conns',
            region: region,
            left:[activeConnMetric],
            right:[newConnectionMetric],
            period: Duration.seconds(1),
            width: 10,
        })

        const lcuWidget = new GraphWidget({
            title: 'Consumed LCUs',
            region: region,
            left:[consumedLCUMetric],
            period: Duration.minutes(1),
            width: 4,
        })

        const responseWidget = new GraphWidget({
            title: 'Fixed Response/Redirect count',
            region: region,
            left:[fixedResponseCount],
            right:[httpRedirectCount],
            period: Duration.seconds(1),
            width: 10,
        })

        const rejectedConnTargetResponseWidget = new GraphWidget({
            title: 'Rejected Connections / Target Response Time',
            region: region,
            left:[rejectedConnectionMetric],
            right: targetResponseTimeArray,
            period: Duration.minutes(1),
            width: 10
        })

        const unHealthyHostWidget = new GraphWidget({
            title: 'Unhealthy Hosts',
            left: unhealthyHostCountMetricArray,
            period: Duration.minutes(1),
            width: 4,
            region: region
        })

        const errorsWidget = new GraphWidget({
            title: 'Errors',
            region: region,
            left:[elb5xxMetric],
            right:[backend5xxMetric],
            period: Duration.seconds(1),
            width: 10,
        })

        this.addWidgetRow(connectionsWidget,lcuWidget,responseWidget);
        this.addWidgetRow(rejectedConnTargetResponseWidget,unHealthyHostWidget,errorsWidget);
        this.alarmSet.push(elb5xxAlarm,backend5xxAlarm);

    }

    getAlarmSet(): [] {
        return this.alarmSet;
    }

    getWidgetSets(): [] {
        return this.widgetSet;
    }


}

