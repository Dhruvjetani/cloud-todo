# Cloud To-Do List: Deployment Guide (AWS)

A Node.js + Express web app deployed on **AWS**.

| Cloud concept | Service used | Role |
|---|---|---|
| Compute | **Amazon EC2** (virtual machine) | Runs the Node.js server |
| Storage | **Amazon S3** (object storage) | Stores the tasks as `tasks.json` |
| Security | **IAM role** + **Security Group** | Gives the VM access to one bucket only; controls network access |
| Monitoring | **CloudWatch** + `pm2` | Resource usage and process management |

```
Browser --HTTP:3000--> EC2 (Node.js app) --IAM role--> S3 bucket (tasks.json)
```

## Project structure

```
cloud-todo/
  server.js        Express server and REST API
  storage.js       Saves data to S3 (or a local file when testing)
  package.json
  public/          Frontend (index.html, style.css, script.js)
  DEPLOYMENT.md
```

## 1. Test locally first

```bash
npm install
npm start
```

Open http://localhost:3000. Without `S3_BUCKET` set, tasks are saved to `data/tasks.json`.

## 2. Create the storage (S3)

1. AWS Console > **S3** > **Create bucket**.
2. Name: something unique, e.g. `yourname-todo-bucket-2026`. Pick a region (e.g. `ap-south-1` Mumbai).
3. Keep **Block all public access** turned ON. The app reads and writes the bucket privately.
4. Create the bucket.

## 3. Create the IAM role for the VM

1. **IAM > Roles > Create role** > trusted entity: **AWS service > EC2**.
2. Skip the managed policies. After creating the role, add an **inline policy** (JSON tab), replacing `YOUR-BUCKET-NAME`:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": ["s3:GetObject", "s3:PutObject"],
      "Resource": "arn:aws:s3:::YOUR-BUCKET-NAME/*"
    }
  ]
}
```

3. Name the role `todo-ec2-s3-role`.

This follows least privilege: the VM can only read and write objects in this one bucket, and no access keys are stored in the code.

## 4. Launch the compute (EC2)

1. **EC2 > Launch instance**.
2. Name: `cloud-todo-server`.
3. AMI: **Amazon Linux 2023**.
4. Instance type: **t3.micro** (or **t2.micro**), whichever is marked free tier eligible.
5. Key pair: create one and download the `.pem` file.
6. **Network settings > Create security group** with these inbound rules:
   - SSH, port 22, Source: **My IP**
   - Custom TCP, port **3000**, Source: **Anywhere (0.0.0.0/0)**
7. **Advanced details > IAM instance profile**: choose `todo-ec2-s3-role`.
8. Launch, then copy the **Public IPv4 address**.

## 5. Deploy the code

From your computer (in the folder that contains `cloud-todo`):

```bash
scp -i your-key.pem -r cloud-todo ec2-user@<PUBLIC-IP>:~/
ssh -i your-key.pem ec2-user@<PUBLIC-IP>
```

On the server:

```bash
sudo dnf install -y nodejs npm
cd ~/cloud-todo
npm install --omit=dev
sudo npm install -g pm2

S3_BUCKET=YOUR-BUCKET-NAME AWS_REGION=YOUR-REGION pm2 start server.js --name todo
pm2 save
pm2 startup        # run the command it prints, so the app restarts after a reboot
```

## 6. Verify it is live on the internet

- Open `http://<PUBLIC-IP>:3000` in any browser, including on your phone.
- Add a few tasks. The footer of the page should say `Storage: Amazon S3 (...)`.
- Check `http://<PUBLIC-IP>:3000/health`. It should return `{"status":"ok"}`.
- In the S3 console, open the bucket. You should see `tasks.json` with your tasks.
- Restart the app with `pm2 restart todo`. Your tasks should still be there, which proves they live in cloud storage and not in the VM's memory.

Take your screenshot now (see the submission section).

## 7. Basic resource management

| Task | How |
|---|---|
| Check app status | `pm2 status`, `pm2 logs todo` |
| Check CPU and memory | `pm2 monit`, `free -m`, or EC2 > Monitoring tab (CloudWatch) |
| Restart the app | `pm2 restart todo` |
| Stop the VM when not needed (stops compute charges) | EC2 > Instance state > **Stop** (the public IP changes when you start it again) |
| Control cost | **Billing > Budgets**: create a budget with an email alert (e.g. $1) |
| Limit access | Keep SSH limited to **My IP**; the S3 bucket stays private |

## 8. Clean up after grading

To avoid charges, delete resources in this order:

1. EC2 > **Terminate** the instance.
2. S3 > **Empty** the bucket, then **Delete** it.
3. EC2 > Security Groups > delete the group you created.
4. IAM > delete `todo-ec2-s3-role`.

---

# Submission Details (fill this in)

| Item | Your answer |
|---|---|
| Student name / ID | |
| Cloud provider | AWS |
| Region | |
| Compute service | Amazon EC2, instance type: |
| Storage service | Amazon S3, bucket name: |
| Operating system | Amazon Linux 2023 |
| Public URL | http://<PUBLIC-IP>:3000 |
| Date deployed | |

**Screenshot:** a browser window showing the running app at the public URL, with the address bar and the page footer (storage and server details) visible. Optionally add a second screenshot of the S3 bucket containing `tasks.json`.

**Short reflection (3 to 4 lines):** what you configured, what challenges you faced, and what you would do differently in production (for example HTTPS with a load balancer, a database such as DynamoDB, and auto scaling).
