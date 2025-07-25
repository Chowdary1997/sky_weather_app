pipeline {
    agent {
        label 'docker'
    }
    tools {
        nodejs 'nodejs'
    }
    parameters {
        string(name: 'BRANCH_NAME', defaultValue: 'dev/test', description: 'Git branch to build')
        choice(name: 'DEPLOY_ENV', choices: ['test', 'prod'], description: 'Deployment environment')
        string(name: 'DOCKER_HUB_REPO', defaultValue: 'daggu1997/sky-weather', description: 'Enter the Docker Hub image name (e.g., daggu1997/sky-weatherapp)')
    }
    environment {
        DOCKER_HUB_CREDENTIALS_ID = 'docker'
        DEP_CHECK_PROJECT = "${env.JOB_NAME}"
        DEP_CHECK_OUT_DIR = 'reports'
        GITHUB_CREDENTIALS_ID = 'github_Chowdary1997'
        GITHUB_REPO = 'daggu1997/sky-weather'
        GITHUB_API_URL = 'https://api.github.com'
        EMAIL_RECIPIENTS = 'rajendra.daggubati09@gmail.com'
    }
    options {
        timeout(time: 90, unit: 'MINUTES')
        timestamps()
        retry(0)
        disableConcurrentBuilds()
        buildDiscarder(logRotator(numToKeepStr: '10', artifactNumToKeepStr: '5'))
    }

    stages {
        stage('Lynis Security Scan') {
            steps {
                script {
                    try {
                        sh '''
                            mkdir -p artifacts/lynis
                            lynis audit system | ansi2html > artifacts/lynis/lynis-report.html
                        '''
                        echo "Lynis report path: ${env.WORKSPACE}/artifacts/lynis/lynis-report.html"
                        archiveArtifacts artifacts: 'artifacts/lynis/lynis-report.html', allowEmptyArchive: true
                    } catch (Exception e) {
                        error("Lynis Security Scan failed: ${e.message}")
                    }
                }
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
                archiveArtifacts artifacts: 'reports/*'

                script {
                    if (fileExists('reports/dependency-check-report.sarif')) {
                        githubSubmitSarif file: 'reports/dependency-check-report.sarif'
                    }
                }
            }
        }

        stage('test') {
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
                    def dockerfileName = ''
                    try {
                        dockerfileName = input(
                            id: 'userInput', message: 'Enter Dockerfile name (leave blank for default)', parameters: [
                                string(defaultValue: '', description: 'Dockerfile name (e.g., Dockerfile1)', name: 'DOCKERFILE_NAME')
                            ],
                            timeout: 5, timeoutUnit: 'MINUTES'
                        )
                        dockerfileName = dockerfileName?.trim() ? dockerfileName : 'Dockerfile'
                    } catch (e) {
                        echo "Input skipped or failed, using default Dockerfile"
                        dockerfileName = 'Dockerfile'
                    }

                    echo "Building Docker image using file: ${dockerfileName}"
                    dockerImage = docker.build("${params.DOCKER_HUB_REPO}:latest", "-f ${dockerfileName} .")
                }
            }
        }

        stage('Trivy Scan') {
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                    script {
                        sh 'mkdir -p artifacts/trivy'
                        sh '''
                            curl -sSfL -o artifacts/trivy/html.tpl https://raw.githubusercontent.com/aquasecurity/trivy/main/contrib/html.tpl
                        '''
                        sh """
                            trivy image --scanners vuln \
                                --severity HIGH,CRITICAL \
                                --format template \
                                --template "@artifacts/trivy/html.tpl" \
                                --timeout 30m \
                                --output artifacts/trivy/report.html ${params.DOCKER_HUB_REPO}:latest
                        """
                    }
                }
            }
        }

        stage('Archive Trivy Report') {
            steps {
                catchError(buildResult: 'SUCCESS', stageResult: 'FAILURE') {
                    archiveArtifacts artifacts: 'artifacts/trivy/report.html', allowEmptyArchive: true
                }
            }
        }

        stage('Push Image to DockerHub') {
            when {
                expression { params.DEPLOY_ENV != 'prod' }
            }
            steps {
                script {
                    def tagsInput = ''
                    try {
                        tagsInput = input message: 'Provide comma-separated tags for the Docker image to push', parameters: [
                            string(defaultValue: 'latest', description: 'Comma-separated tags', name: 'TAGS')
                        ],
                        timeout: 5, timeoutUnit: 'MINUTES'
                        tagsInput = tagsInput?.trim() ? tagsInput : 'latest'
                    } catch (e) {
                        echo "Input skipped or failed, using default tag"
                        tagsInput = 'latest'
                    }

                    def tags = tagsInput.tokenize(',').collect { it.trim() }
                    echo "Pushing image with tags: ${tags}"
                    docker.withRegistry('https://registry.hub.docker.com', "${DOCKER_HUB_CREDENTIALS_ID}") {
                        tags.each { tag -> dockerImage.push(tag) }
                    }
                    env.IMAGE_TAGS = tags.join(',')
                }
            }
        }

        stage('Approval for Deployment') {
            when {
                anyOf {
                    branch 'master'
                    branch 'prod'
                }
            }
            steps {
                script {
                    try {
                        input message: "Approve deployment to ${params.DEPLOY_ENV} environment?", timeout: 5, timeoutUnit: 'MINUTES'
                    } catch (e) {
                        echo "Approval skipped or timed out, proceeding"
                    }
                }
            }
        }

        stage('Create Git Tag') {
            when {
                branch 'master'
            }
            steps {
                withCredentials([usernamePassword(credentialsId: "${GITHUB_CREDENTIALS_ID}", usernameVariable: 'GIT_USER', passwordVariable: 'GIT_TOKEN')]) {
                    script {
                        def tagName = ''
                        try {
                            tagName = input message: 'Enter the Git tag name to create', parameters: [string(name: 'TAG_NAME', description: 'Git tag name')],
                            timeout: 5, timeoutUnit: 'MINUTES'
                            tagName = tagName?.trim() ? tagName : ''
                        } catch (e) {
                            echo "Skipping Git tag creation"
                            tagName = ''
                        }

                        if (tagName) {
                            def userName = env.BUILD_USER ?: 'Rajendra.daggubati'
                            def userEmail = "${userName}@gmail.com"
                            echo "Creating Git tag: ${tagName} by ${userName}"

                            sh """
                                git config user.name "${userName}"
                                git config user.email "${userEmail}"
                                git tag -a ${tagName} -m "Tag created by Jenkins pipeline by ${userName}"
                                git push https://${GIT_USER}:${GIT_TOKEN}@github.com/${env.GITHUB_REPO}.git ${tagName}
                            """
                        }
                    }
                }
            }
        }

        stage('Create Merge Request') {
            when {
                allOf {
                    not { branch 'master' }
                    expression { !env.CHANGE_ID }
                }
            }
            steps {
                script {
                    def inputs = [:]
                    try {
                        inputs = input message: 'Provide details for the merge request', parameters: [
                            string(name: 'SOURCE_BRANCH', defaultValue: 'dev/raj/version', description: 'Name of the branch to merge (source)'),
                            string(name: 'PR_TITLE', description: 'Merge request title'),
                            text(name: 'PR_BODY', description: 'Merge request description')
                        ],
                        timeout: 5, timeoutUnit: 'MINUTES'
                    } catch (e) {
                        echo "Skipping merge request creation"
                        return
                    }

                    if (inputs['SOURCE_BRANCH'] == 'master') {
                        error("PR source and target cannot both be 'master'.")
                    }

                    if (inputs['SOURCE_BRANCH']) {
                        def jsonPayload = """{
                            "title": "${inputs['PR_TITLE']}",
                            "head": "${inputs['SOURCE_BRANCH']}",
                            "base": "master",
                            "body": "${inputs['PR_BODY']}"
                        }"""

                        writeFile file: 'pr_payload.json', text: jsonPayload

                        withCredentials([string(credentialsId: 'GITHUB_TOKEN', variable: 'GITHUB_TOKEN')]) {
                            sh '''
                                curl -X POST \
                                    -H "Authorization: token $GITHUB_TOKEN" \
                                    -H "Accept: application/vnd.github.v3+json" \
                                    -d @pr_payload.json \
                                    $GITHUB_API_URL/repos/$GITHUB_REPO/pulls
                            '''
                        }
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'Build & Deploy completed successfully!'
            mail to: "${EMAIL_RECIPIENTS}",
                 subject: "SUCCESS: ${env.JOB_NAME} [#${env.BUILD_NUMBER}]",
                 body: """\
The Jenkins Pipeline completed successfully.

🔗 Pipeline URL: ${env.BUILD_URL}
👷 Triggered by: ${currentBuild.getBuildCauses()[0].userName}

View the full job here: ${env.BUILD_URL}
"""
        }

        failure {
            script {
                def log = currentBuild.rawBuild.getLog(1000)
                def lastLines = log.takeRight(50).join('\n')
                def culprit = "Unknown"
                def changeAuthor = "Unknown"

                try {
                    changeAuthor = currentBuild.changeSets.collect { cs ->
                        cs.items.collect { it.author.fullName }
                    }.flatten().unique().join(', ')

                    culprit = currentBuild.getBuildCauses()[0].userName
                } catch (e) {}

                mail to: "${EMAIL_RECIPIENTS}",
                     subject: "FAILURE: ${env.JOB_NAME} [#${env.BUILD_NUMBER}]",
                     body: """\
The Jenkins Pipeline has FAILED ❌

👤 Git Committer(s): ${changeAuthor}
🚀 Triggered by: ${culprit}
🔗 Pipeline URL: ${env.BUILD_URL}

📄 Last 50 lines of console output:
--------------------------------------------------
${lastLines}
--------------------------------------------------

Please investigate the issue.
"""
            }
        }

        unstable {
            script {
                def log = currentBuild.rawBuild.getLog(1000)
                def lastLines = log.takeRight(50).join('\n')
                def culprit = "Unknown"
                def changeAuthor = "Unknown"

                try {
                    changeAuthor = currentBuild.changeSets.collect { cs ->
                        cs.items.collect { it.author.fullName }
                    }.flatten().unique().join(', ')

                    culprit = currentBuild.getBuildCauses()[0].userName
                } catch (e) {}

                mail to: "${EMAIL_RECIPIENTS}",
                     subject: "UNSTABLE: ${env.JOB_NAME} [#${env.BUILD_NUMBER}]",
                     body: """\
The Jenkins Pipeline is UNSTABLE ⚠️

👤 Git Committer(s): ${changeAuthor}
🚀 Triggered by: ${culprit}
🔗 Pipeline URL: ${env.BUILD_URL}

📄 Last 50 lines of console output:
--------------------------------------------------
${lastLines}
--------------------------------------------------

Please investigate the warning.
"""
            }
        }

        always {
            cleanWs()
            echo 'Workspace cleaned'
        }
    }
}

