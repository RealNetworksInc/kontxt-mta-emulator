pipeline {
    agent any
    environment {
        registry = "808964640426.dkr.ecr.us-east-1.amazonaws.com/kontxt-smtp-emulator"
        registryCredential = 'ecr-login'
    }
    parameters {
        listGitBranches(
            branchFilter: '^(?!.*master)(?!.*feature)(?!.*develop).*$',
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
                credentialsId: '518101fd-f8bc-4cd9-be3d-5ad1923621dc',
                branch: "${FROM_BRANCH}"
            }
        }
         stage('Build image'){
            steps {
                script {
                    VER = sh( script: '''#!/bin/bash
                        echo ${BRANCH_SELECT} | sed '1s|^refs/heads/||' | cut -d '/' -f 2
                    ''',returnStdout: true)
                    sh("docker build -t kontxt-smtp-emulator:latest .")
                    sh("docker tag kontxt-smtp-emulator:latest $registry:${VER}")

                }
            }
        }
        stage('Push images'){
            steps{
                script {
                    sh("eval \$(aws ecr get-login --no-include-email | sed 's|https://||')")
                    sh("docker push $registry:${VER}")
                }
            }
        }
   }
   post {
        always {
            // make sure that the Docker image is removed
            sh("docker rmi $registry:${VER} --force")
        }
    }
}
