#!/bin/bash

# GitHub Management Script
# سكربت إدارة GitHub

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored messages
print_message() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check if git is initialized
check_git() {
    if [ ! -d ".git" ]; then
        print_warning "Git repository not initialized"
        read -p "Do you want to initialize git? (y/n): " init_git
        if [ "$init_git" = "y" ] || [ "$init_git" = "Y" ]; then
            git init
            print_message "Git repository initialized"
        else
            print_error "Cannot proceed without git repository"
            exit 1
        fi
    fi
}

# Function to initialize git and connect to GitHub
init_github() {
    check_git
    
    if [ -z "$(git remote -v)" ]; then
        print_message "No remote repository found"
        read -p "Enter GitHub repository URL: " repo_url
        
        if [ -z "$repo_url" ]; then
            print_error "Repository URL is required"
            exit 1
        fi
        
        git remote add origin "$repo_url"
        print_message "Remote repository added: $repo_url"
    else
        print_message "Remote repository already exists:"
        git remote -v
    fi
}

# Function to add all changes and commit
commit_changes() {
    check_git
    
    print_message "Checking status..."
    git status
    
    read -p "Enter commit message: " commit_msg
    
    if [ -z "$commit_msg" ]; then
        commit_msg="Update: $(date '+%Y-%m-%d %H:%M:%S')"
        print_warning "Using default commit message: $commit_msg"
    fi
    
    print_message "Adding all changes..."
    git add .
    
    print_message "Committing changes..."
    git commit -m "$commit_msg"
    
    print_message "Changes committed successfully!"
}

# Function to push to GitHub
push_to_github() {
    check_git
    
    branch=$(git branch --show-current)
    if [ -z "$branch" ]; then
        branch="main"
        git branch -M main
        print_message "Created and switched to main branch"
    fi
    
    print_message "Pushing to GitHub (branch: $branch)..."
    
    if [ -z "$(git remote -v)" ]; then
        print_error "No remote repository found. Run 'init_github' first."
        exit 1
    fi
    
    git push -u origin "$branch"
    
    if [ $? -eq 0 ]; then
        print_message "Successfully pushed to GitHub!"
    else
        print_error "Failed to push to GitHub"
        exit 1
    fi
}

# Function to pull from GitHub
pull_from_github() {
    check_git
    
    branch=$(git branch --show-current)
    if [ -z "$branch" ]; then
        branch="main"
    fi
    
    print_message "Pulling from GitHub (branch: $branch)..."
    git pull origin "$branch"
    
    if [ $? -eq 0 ]; then
        print_message "Successfully pulled from GitHub!"
    else
        print_error "Failed to pull from GitHub"
        exit 1
    fi
}

# Function to create a new branch
create_branch() {
    check_git
    
    read -p "Enter branch name: " branch_name
    
    if [ -z "$branch_name" ]; then
        print_error "Branch name is required"
        exit 1
    fi
    
    print_message "Creating branch: $branch_name"
    git checkout -b "$branch_name"
    
    print_message "Branch created and switched to: $branch_name"
}

# Function to switch branch
switch_branch() {
    check_git
    
    print_message "Available branches:"
    git branch
    
    read -p "Enter branch name to switch to: " branch_name
    
    if [ -z "$branch_name" ]; then
        print_error "Branch name is required"
        exit 1
    fi
    
    print_message "Switching to branch: $branch_name"
    git checkout "$branch_name"
    
    if [ $? -eq 0 ]; then
        print_message "Switched to branch: $branch_name"
    else
        print_error "Failed to switch branch"
        exit 1
    fi
}

# Function to show status
show_status() {
    check_git
    
    print_message "Git Status:"
    echo ""
    git status
    
    echo ""
    print_message "Recent Commits:"
    git log --oneline -5
    
    echo ""
    print_message "Remote Repositories:"
    git remote -v
}

# Function to sync (pull then push)
sync_github() {
    check_git
    
    print_message "Syncing with GitHub..."
    
    branch=$(git branch --show-current)
    if [ -z "$branch" ]; then
        branch="main"
    fi
    
    print_message "Pulling latest changes..."
    git pull origin "$branch"
    
    if [ $? -eq 0 ]; then
        print_message "Pushing local changes..."
        git push origin "$branch"
        
        if [ $? -eq 0 ]; then
            print_message "Successfully synced with GitHub!"
        else
            print_error "Failed to push changes"
        fi
    else
        print_error "Failed to pull changes. Resolve conflicts first."
    fi
}

# Main menu
show_menu() {
    echo ""
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}    GitHub Management Script${NC}"
    echo -e "${BLUE}    سكربت إدارة GitHub${NC}"
    echo -e "${BLUE}========================================${NC}"
    echo ""
    echo "1. Initialize Git & Connect to GitHub"
    echo "2. Commit Changes"
    echo "3. Push to GitHub"
    echo "4. Pull from GitHub"
    echo "5. Sync (Pull + Push)"
    echo "6. Create New Branch"
    echo "7. Switch Branch"
    echo "8. Show Status"
    echo "9. Exit"
    echo ""
}

# Main script
main() {
    while true; do
        show_menu
        read -p "Choose an option (1-9): " choice
        
        case $choice in
            1)
                init_github
                ;;
            2)
                commit_changes
                ;;
            3)
                push_to_github
                ;;
            4)
                pull_from_github
                ;;
            5)
                sync_github
                ;;
            6)
                create_branch
                ;;
            7)
                switch_branch
                ;;
            8)
                show_status
                ;;
            9)
                print_message "Goodbye!"
                exit 0
                ;;
            *)
                print_error "Invalid option. Please choose 1-9."
                ;;
        esac
        
        echo ""
        read -p "Press Enter to continue..."
    done
}

# Run main function
main

