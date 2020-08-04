pipeline {
    agent any
    environment {
        registry = "808964640426.dkr.ecr.us-east-1.amazonaws.com/kontxt-smtp-emulator"
        registryCredential = 'ecr-login'
    }
    stages {
        stage('Prepare build') {
            steps {
                git url: 'git@gitlab.kontxt.cloud:docker/kontxt-smtp-emulator.git',
                credentialsId: 'daf6978b-48a6-43bd-ad76-39767976f00d',
                branch: "master"
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
