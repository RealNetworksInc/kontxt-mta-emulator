pipeline {
    agent any
    environment {
        registry = "808964640426.dkr.ecr.us-east-1.amazonaws.com/kontxt-smtp-emulator"
        registryCredential = 'ecr-login'
    }
    parameters {
        listGitBranches(
            branchFilter: '(.*)[hotfix|release]/(.*)',
            defaultValue: '',
            sortMode: 'DESCENDING_SMART',
            name: 'BRANCH_SELECT',
            type: 'BRANCH',
            remoteURL: 'git@gitlab.kontxt.cloud:docker/kontxt-smtp-emulator.git',
            credentialsId: '518101fd-f8bc-4cd9-be3d-5ad1923621dc')
    }
    stages {
        stage('Prepare build') {
            steps {
                script {
                FROM_BRANCH = sh( script: '''#!/bin/bash
                echo ${BRANCH_SELECT} | sed '1s|^refs/heads/||'
                ''',returnStdout: true)
                }                              
                git url: 'git@gitlab.kontxt.cloud:docker/kontxt-smtp-emulator.git',
                credentialsId: 'daf6978b-48a6-43bd-ad76-39767976f00d',
                branch: "${FROM_BRANCH}"
            }
        }
         stage('Build image'){
            steps {
                script {
                    sh('docker build -t $registry:$BUILD_NUMBER .')
                }
            }
        }
        stage('Push images'){
            steps{
                script {
                    sh("eval \$(aws ecr get-login --no-include-email | sed 's|https://||')")
                    sh('docker push $registry:$BUILD_NUMBER')
                }
            }
        }
   }
   post {
        always {
            // make sure that the Docker image is removed
            sh('docker rmi $registry:$BUILD_NUMBER --force')
        }
    }
}
