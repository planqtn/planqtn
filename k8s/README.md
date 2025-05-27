To setup the cluster and the connection to the supabase containers:

- setup supabase using docker
- setup k3d if not installed

- create the job-monitor service account / role

```
 kubectl apply -f k8s/job-monitor-rbac.yaml --cluster k3d-plaqntn
```

- create cluster planqtn on the supabase docker network (supabase_network_planqtn-dev)

- create the k3d-plaqntn-in-cluster context in the `~/.kube/config` file ...

```
  - cluster:
      certificate-authority-data: <same as k3d-plaqntn>
      server: https://k3d-plaqntn-serverlb:6443
    name: k3d-plaqntn-in-cluster
```

- start proxy

```
docker run --network supabase_network_planqtn-dev --rm --name k8sproxy --user `id -u` -v ~/.kube/config:/.kube/config d3fk/kubectl proxy --accept-hosts ".*" --context k3d-plaqntn-in-cluster --address=0.0.0.0
```

- ensure images are loaded

```
 k3d image import balopat/planqtn_jobs:fcef395-dirty -c plaqntn
```
