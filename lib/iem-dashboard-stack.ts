import {Stack,StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs'
import {GraphFactory} from "./services/graphfactory";
import {Dashboard} from "aws-cdk-lib/aws-cloudwatch";

const config = require('./config.json');

export class IemDashboardStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const dashboard = new Dashboard(this,config.BaseName,{
      dashboardName: config.BaseName + '-Dashboard'
    });

    let resources:any = [];
    try {
      resources = require(config.ResourceFile);
      console.log(`LOADED RESOURCE FILE ${config.ResourceFile}`);
    } catch {
      console.log(`ERROR: ${config.ResourceFile} not found, run 'cd data; python resource_collector.py'`);
    }

    const graphFactory = new GraphFactory(this,'GraphFactory',resources, config);

    for (let widget of graphFactory.getWidgets()){
      dashboard.addWidgets(widget);
    }
  }
}
