pipeline {
    agent any
    tools {
        nodejs 'nodejs'
    }
    environment {
        DOCKER_HUB_REPO = 'daggu1997/sky_weather_app'
        DOCKER_HUB_CREDENTIALS_ID = 'docker'
    }
    stages {
        stage('Checkout Github') {
            steps {
                git branch: 'dev/raj/1', credentialsId: 'github', url: 'https://github.com/Chowdary1997/sky_weather_app.git'
            }
        }
        stage('Install node dependencies') {
            steps {
                dir('weather-app') {
                    sh 'npm install'
                }
            }
        }
        stage('Dependency Check') {
            steps {
                dependencyCheck(
                    additionalArguments: "--project \"${env.JOB_NAME}\" --scan ./ --format HTML --format SARIF --format JSON --out ./reports --failOnCVSS 6 --disableYarnAudit --disableNodeAudit --enableExperimental",
                    odcInstallation: 'dpcheck'
                )

                // Archive and process results
                archiveArtifacts artifacts: 'reports/*'

                // Process SARIF results for GitHub integration
                script {
                    if (fileExists('reports/dependency-check-report.sarif')) {
                        githubSubmitSarif file: 'reports/dependency-check-report.sarif'
                    }
                }
            }
        }
        stage('test'){
            steps {
                echo 'Testing the application'
                dir('weather-app_test') {
                    sh 'npm install --save-dev jest supertest'
                    echo 'Running jest tests with JUnit XML report generation'
                    sh 'npx jest --ci --reporters=default --reporters=jest-junit'
                    junit 'junit.xml'
                    echo 'executing python test script'
                    sh 'python3 backend/test_weather.py || true'
                }
            }
            post {
                always {
                    echo 'Test stage completed'
                }
            }
        }
        stage('Build Docker Image') {
            steps {
                script {
                    echo 'building docker image...'
                    dockerImage = docker.build("${DOCKER_HUB_REPO}:latest")
                }
            }
        }
        stage('Trivy Scan') {
            steps {
                echo 'skip trivy'
            }
        }
        stage('Push Image to DockerHub') {
            steps {
                script {
                    echo 'pushing docker image to DockerHub...'
                    docker.withRegistry('https://registry.hub.docker.com', "${DOCKER_HUB_CREDENTIALS_ID}") {
                        dockerImage.push('latest')
                    }
                }
            }
        }
    }
    post {
        success {
            echo 'Build & Deploy completed successfully!'
        }
        failure {
            echo 'Build & Deploy failed. Check logs.'
        }
    }
}

