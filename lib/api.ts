import * as cdk from '@aws-cdk/core';
import * as lambda from '@aws-cdk/aws-lambda-nodejs';
import * as apigw from '@aws-cdk/aws-apigatewayv2';
import { Runtime } from '@aws-cdk/aws-lambda';
import * as s3 from '@aws-cdk/aws-s3';
import * as path from 'path';
import * as iam from '@aws-cdk/aws-iam';
import * as apigi from '@aws-cdk/aws-apigatewayv2-integrations';

interface DocumentManagementAPIProps {
  documentBucket: s3.IBucket;
}

export class DocumentManagementAPI extends cdk.Construct {
  public readonly httpApi: apigw.HttpApi;

  constructor(scope: cdk.Construct, id: string, props: DocumentManagementAPIProps) {
    super(scope, id);

    const getDocumentsFunction = new lambda.NodejsFunction(this, 'GetDocumentsFunction', {
      runtime: Runtime.NODEJS_16_X,
      entry: path.join(__dirname, '..', 'api', 'getDocuments', 'index.ts'),
      handler: 'getDocuments',
      bundling: {
        externalModules: ['aws-sdk'],
      },
      environment: {
        DOCUMENTS_BUCKET_NAME: props.documentBucket.bucketName,
      },
    });

    const bucketPermissions = new iam.PolicyStatement();
    bucketPermissions.addResources(`${props.documentBucket.bucketArn}/*`);
    bucketPermissions.addActions('s3:GetObject', 's3:PutObject');
    getDocumentsFunction.addToRolePolicy(bucketPermissions);

    const bucketContainerPermissions = new iam.PolicyStatement();
    bucketContainerPermissions.addResources(props.documentBucket.bucketArn);
    bucketContainerPermissions.addActions('s3:ListBucket');
    getDocumentsFunction.addToRolePolicy(bucketContainerPermissions);

    this.httpApi = new apigw.HttpApi(this, 'HttpAPI', {
      apiName: 'document-management-api',
      createDefaultStage: true,
      corsPreflight: {
        allowMethods: [apigw.CorsHttpMethod.GET],
        allowOrigins: ['*'],
        maxAge: cdk.Duration.days(10),
      },
    });

    const integration = new apigi.HttpLambdaIntegration(
      'CommentsServiceIntegration',
      getDocumentsFunction,
      {},
    );

    this.httpApi.addRoutes({
      path: '/getDocuments',
      methods: [apigw.HttpMethod.GET],
      integration: integration,
    });

    new cdk.CfnOutput(this, 'APIEndpoint', {
      value: this.httpApi.url!,
      exportName: 'APIEndpoint',
    });
  }
}
